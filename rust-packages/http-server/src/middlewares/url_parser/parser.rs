use url::{Host, Url};

pub struct ParsedUrl {
    pub path: String,
    pub query: Option<String>,
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<u16>,
}

pub fn parse_url(raw: &str) -> Result<ParsedUrl, url::ParseError> {
    let parsed = Url::parse(raw)?;

    let protocol = Some(parsed.scheme().to_string());

    let hostname = parsed.host().map(|host| match host {
        Host::Domain(domain) => domain.to_string(),
        Host::Ipv4(addr) => addr.to_string(),
        Host::Ipv6(addr) => addr.to_string(),
    });

    let port = parsed.port();

    let host = parsed.host().map(|host| match host {
        Host::Domain(domain) => match port {
            Some(port) => format!("{domain}:{port}"),
            None => domain.to_string(),
        },
        Host::Ipv4(addr) => match port {
            Some(port) => format!("{addr}:{port}"),
            None => addr.to_string(),
        },
        Host::Ipv6(addr) => match port {
            Some(port) => format!("[{addr}]:{port}"),
            None => format!("[{addr}]"),
        },
    });

    Ok(ParsedUrl {
        path: parsed.path().to_string(),
        query: parsed.query().map(|q| q.to_string()),
        protocol,
        host,
        hostname,
        port,
    })
}
