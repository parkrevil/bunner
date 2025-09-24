use super::Middleware;
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use lazy_static::lazy_static;
use publicsuffix::{List, Psl};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};

pub struct HeaderParser {
    trust_proxy: bool,
}

lazy_static! {
    static ref PUBLIC_SUFFIX_LIST: List = List::default();
}

impl HeaderParser {
    pub fn new(trust_proxy: bool) -> Self {
        Self { trust_proxy }
    }
}

impl Middleware for HeaderParser {
    #[tracing::instrument(
        level = "trace",
        skip(self, req, _res, payload),
        fields(ct = payload
            .headers
            .get("content-type")
            .map(|s| s.as_str())
            .unwrap_or(""))
    )]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation = "header_parser");

        req.headers = payload.headers.clone();
        req.forwarded = payload.headers.get("forwarded").cloned();

        let forwarded_values = if self.trust_proxy {
            payload
                .headers
                .get("forwarded")
                .map(|value| parse_forwarded_values(value))
                .unwrap_or_default()
        } else {
            ForwardedValues::default()
        };

        req.protocol = if self.trust_proxy {
            forwarded_values
                .proto
                .clone()
                .or_else(|| {
                    payload
                        .headers
                        .get("x-forwarded-proto")
                        .and_then(|value| first_header_value(value))
                        .map(|proto| proto.to_lowercase())
                })
        } else {
            None
        };

        let host_header = if self.trust_proxy {
            forwarded_values
                .host
                .clone()
                .or_else(|| {
                    payload
                        .headers
                        .get("x-forwarded-host")
                        .and_then(|value| first_header_value(value))
                })
                .or_else(|| payload.headers.get("host").cloned())
        } else {
            payload.headers.get("host").cloned()
        };

        req.host = host_header.clone();

        let (hostname, port) = host_header
            .as_deref()
            .map(split_host_port)
            .unwrap_or((None, None));

        req.hostname = hostname;
        req.port = port;


        req.subdomains = req
            .hostname
            .as_ref()
            .map(|hostname| compute_subdomains(hostname));

        if let Some(ct) = payload.headers.get("content-type") {
            let ct_trimmed = ct.trim();
            if !ct_trimmed.is_empty() {
                match parse_content_type(ct_trimmed) {
                    Ok((media_type, parameters)) => {
                        req.content_type = Some(media_type);
                        if let Some(charset) = parameters.get("charset") {
                            req.charset = Some(charset.clone());
                        }
                    }
                    Err(_) => {
                        tracing::event!(
                            tracing::Level::TRACE,
                            warning = "invalid_content_type",
                            value = %ct_trimmed
                        );
                        req.content_type = Some(ct_trimmed.to_string());
                    }
                }
            }
        }

        if let Some(content_length) = payload.headers.get("content-length") {
            match content_length.trim().parse::<u64>() {
                Ok(len) => req.content_length = Some(len),
                Err(err) => {
                    tracing::event!(
                        tracing::Level::WARN,
                        warning = "invalid_content_length",
                        value = %content_length,
                        %err
                    );
                    req.content_length = None;
                }
            }
        }

        true
    }
}

fn parse_content_type(
    content_type: &str,
) -> Result<(String, HashMap<String, String>), &'static str> {
    let content_type = content_type.trim();

    if content_type.is_empty() {
        return Err("empty content-type");
    }

    let mut parts = content_type.splitn(2, ';');
    let media_type = parts.next().unwrap().trim().to_lowercase();

    if media_type.is_empty() {
        return Err("empty media type");
    }

    let mut parameters = HashMap::new();

    if let Some(params_str) = parts.next() {
        for param in params_str.split(';') {
            let param = param.trim();
            if param.is_empty() {
                continue;
            }

            let mut kv = param.splitn(2, '=');
            let key = kv
                .next()
                .map(|s| s.trim().to_lowercase())
                .ok_or("invalid parameter format")?;

            let value = kv
                .next()
                .map(|s| strip_surrounding_quotes(s.trim()))
                .unwrap_or_default();

            if !key.is_empty() && !parameters.contains_key(&key) {
                parameters.insert(key, value);
            }
        }
    }

    Ok((media_type, parameters))
}

#[derive(Default)]
struct ForwardedValues {
    proto: Option<String>,
    host: Option<String>,
    client: Option<String>,
}

fn parse_forwarded_values(header: &str) -> ForwardedValues {
    let mut values = ForwardedValues::default();
    let first_element = header.split(',').next().unwrap_or("");

    for segment in first_element.split(';') {
        let segment = segment.trim();
        if segment.is_empty() {
            continue;
        }

        let mut parts = segment.splitn(2, '=');
        let key = parts.next().unwrap_or("").trim().to_lowercase();
        if key.is_empty() {
            continue;
        }

        let raw_value = parts.next().unwrap_or("").trim();
    let cleaned = strip_surrounding_quotes(raw_value);

        match key.as_str() {
            "proto" => values.proto = Some(cleaned.to_lowercase()),
            "host" => values.host = Some(cleaned),
            "for" => values.client = Some(cleaned),
            _ => {}
        }
    }

    values
}

fn split_host_port(host: &str) -> (Option<String>, Option<u16>) {
    let trimmed = host.trim();

    if let Ok(socket_addr) = trimmed.parse::<SocketAddr>() {
        return (
            Some(socket_addr.ip().to_string()),
            Some(socket_addr.port()),
        );
    }

    if let Some(stripped) = trimmed
        .strip_prefix('[')
        .and_then(|rest| rest.split_once(']'))
        .map(|(inside, remainder)| (inside, remainder.trim_start()))
    {
        let (inside, remainder) = stripped;
        if let Ok(ip) = inside.parse::<IpAddr>() {
            let port = remainder
                .strip_prefix(':')
                .and_then(|segment| segment.parse::<u16>().ok());
            return (Some(ip.to_string()), port);
        }

        let port = remainder
            .strip_prefix(':')
            .and_then(|segment| segment.parse::<u16>().ok());
        return (Some(inside.to_string()), port);
    }

    if let Ok(ip_addr) = trimmed.parse::<IpAddr>() {
        return (Some(ip_addr.to_string()), None);
    }

    if let Some((host_part, port_part)) = trimmed.rsplit_once(':') {
        if !host_part.contains(':') {
            if let Ok(port) = port_part.parse::<u16>() {
                return (Some(host_part.to_string()), Some(port));
            }
        }
    }

    (Some(trimmed.to_string()), None)
}

fn compute_subdomains(hostname: &str) -> Vec<String> {
    if hostname.parse::<IpAddr>().is_ok() {
        return Vec::new();
    }

    let host = hostname.trim_end_matches('.');
    if host.is_empty() {
        return Vec::new();
    }

    if let Some(domain) = PUBLIC_SUFFIX_LIST.domain(host.as_bytes()) {
        let domain_bytes = domain.as_bytes();
        if let Some(pos) = host.as_bytes().len().checked_sub(domain_bytes.len() + 1) {
            if host.as_bytes().len() > domain_bytes.len() {
                let sub = &host.as_bytes()[..pos];
                if !sub.is_empty() {
                    return sub
                        .split(|b| *b == b'.')
                        .filter(|label| !label.is_empty())
                        .map(|label| String::from_utf8_lossy(label).into_owned())
                        .collect();
                }
            }
        }
    }
    Vec::new()
}

fn first_header_value(header: &str) -> Option<String> {
    header
        .split(',')
        .next()
        .map(|segment| segment.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

fn strip_surrounding_quotes(value: &str) -> String {
    let mut trimmed = value.trim();

    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];

        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            trimmed = &trimmed[1..trimmed.len() - 1];
        }
    }

    trimmed.trim().to_string()
}
