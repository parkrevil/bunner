use super::host;

#[cfg(test)]
mod split_host_port {
    use super::host::split_host_port;

    #[test]
    fn parses_ipv4_with_port() {
        let (host, port) = split_host_port("192.168.10.5:8080");

        assert_eq!(host.as_deref(), Some("192.168.10.5"));
        assert_eq!(port, Some(8080));
    }

    #[test]
    fn parses_ipv6_with_port() {
        let (host, port) = split_host_port("[2001:db8::1]:443");

        assert_eq!(host.as_deref(), Some("2001:db8::1"));
        assert_eq!(port, Some(443));
    }

    #[test]
    fn parses_hostname_with_port() {
        let (host, port) = split_host_port("example.com:3000");

        assert_eq!(host.as_deref(), Some("example.com"));
        assert_eq!(port, Some(3000));
    }

    #[test]
    fn trims_whitespace_around_host() {
        let (host, port) = split_host_port("  example.org  ");

        assert_eq!(host.as_deref(), Some("example.org"));
        assert_eq!(port, None);
    }

    #[test]
    fn retains_full_host_when_port_invalid() {
        let (host, port) = split_host_port("example.com:abc");

        assert_eq!(host.as_deref(), Some("example.com:abc"));
        assert_eq!(port, None);
    }

    #[test]
    fn parses_ipv4_without_port() {
        let (host, port) = split_host_port("203.0.113.5");

        assert_eq!(host.as_deref(), Some("203.0.113.5"));
        assert_eq!(port, None);
    }

    #[test]
    fn parses_ipv6_without_brackets() {
        let (host, port) = split_host_port("2001:db8::2");

        assert_eq!(host.as_deref(), Some("2001:db8::2"));
        assert_eq!(port, None);
    }

    #[test]
    fn handles_bracketed_hostname() {
        let (host, port) = split_host_port("[app.internal]:8080");

        assert_eq!(host.as_deref(), Some("app.internal"));
        assert_eq!(port, Some(8080));
    }

    #[test]
    fn parses_bracketed_hostname_without_port() {
        let (host, port) = split_host_port("[service.internal]");

        assert_eq!(host.as_deref(), Some("service.internal"));
        assert_eq!(port, None);
    }
}

#[cfg(test)]
mod compute_subdomains {
    use super::host::compute_subdomains;

    #[test]
    fn returns_subdomain_segments_in_order() {
        let subdomains = compute_subdomains("api.eu.example.com");

        assert_eq!(subdomains, vec!["api".to_string(), "eu".to_string()]);
    }

    #[test]
    fn returns_empty_for_root_domain() {
        let subdomains = compute_subdomains("example.com");

        assert!(subdomains.is_empty());
    }

    #[test]
    fn returns_empty_for_ip_address() {
        let subdomains = compute_subdomains("203.0.113.10");

        assert!(subdomains.is_empty());
    }

    #[test]
    fn handles_trailing_dot() {
        let subdomains = compute_subdomains("app.service.example.org.");

        assert_eq!(subdomains, vec!["app".to_string(), "service".to_string()]);
    }

    #[test]
    fn returns_empty_for_unknown_suffix() {
        let subdomains = compute_subdomains("dev.internal");

        assert!(subdomains.is_empty());
    }

    #[test]
    fn handles_multi_level_public_suffix() {
        let subdomains = compute_subdomains("pod.api.example.co.uk");

        assert_eq!(
            subdomains,
            vec!["pod".to_string(), "api".to_string(), "example".to_string()]
        );
    }

    #[test]
    fn returns_empty_for_empty_hostname() {
        let subdomains = compute_subdomains("");

        assert!(subdomains.is_empty());
    }
}
