mod content_type;
#[cfg(test)]
mod content_type_test;
mod forwarded;
#[cfg(test)]
mod forwarded_test;
#[cfg(test)]
mod header_parser_test;
mod host;
#[cfg(test)]
mod host_test;
mod utils;
#[cfg(test)]
mod utils_test;

use super::Middleware;
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use content_type::parse_content_type;
use forwarded::{ForwardedValues, parse_forwarded_values};
use host::{compute_subdomains, split_host_port};
use utils::first_header_value;

pub struct HeaderParser {
    trust_proxy: bool,
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
            forwarded_values.proto.clone().or_else(|| {
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
