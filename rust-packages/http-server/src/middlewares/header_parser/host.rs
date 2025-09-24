use lazy_static::lazy_static;
use publicsuffix::{List, Psl};
use std::net::{IpAddr, SocketAddr};
use std::str;

lazy_static! {
    static ref PUBLIC_SUFFIX_LIST: List = List::default();
}

pub(super) fn split_host_port(host: &str) -> (Option<String>, Option<u16>) {
    let trimmed = host.trim();

    if let Ok(socket_addr) = trimmed.parse::<SocketAddr>() {
        return (Some(socket_addr.ip().to_string()), Some(socket_addr.port()));
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

    if let Some((host_part, port_part)) = trimmed.rsplit_once(':')
        && !host_part.contains(':')
        && let Ok(port) = port_part.parse::<u16>()
    {
        return (Some(host_part.to_string()), Some(port));
    }

    (Some(trimmed.to_string()), None)
}

pub(super) fn compute_subdomains(hostname: &str) -> Vec<String> {
    if hostname.parse::<IpAddr>().is_ok() {
        return Vec::new();
    }

    let host = hostname.trim_end_matches('.');
    if host.is_empty() {
        return Vec::new();
    }

    if let Some(domain) = PUBLIC_SUFFIX_LIST.domain(host.as_bytes()) {
        let domain_str = match str::from_utf8(domain.as_bytes()) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        if let Some(prefix) = host
            .strip_suffix(domain_str)
            .and_then(|p| p.strip_suffix('.'))
            .filter(|p| !p.is_empty())
        {
            return prefix
                .split('.')
                .filter(|segment| !segment.is_empty())
                .map(|segment| segment.to_string())
                .collect();
        }
    }

    Vec::new()
}
