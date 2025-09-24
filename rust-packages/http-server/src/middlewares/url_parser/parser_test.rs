use super::parser::parse_url;

mod parse_url {
    use super::parse_url;
    use url::ParseError;

    #[test]
    fn parses_standard_http_url_components() {
        let parsed = parse_url("http://example.com/api/v1/items?foo=bar&baz=qux").unwrap();

        assert_eq!(parsed.path, "/api/v1/items");
        assert_eq!(parsed.query.as_deref(), Some("foo=bar&baz=qux"));
        assert_eq!(parsed.protocol.as_deref(), Some("http"));
        assert_eq!(parsed.host.as_deref(), Some("example.com"));
        assert_eq!(parsed.hostname.as_deref(), Some("example.com"));
        assert_eq!(parsed.port, None);
    }

    #[test]
    fn parses_https_url_with_explicit_port() {
        let parsed = parse_url("https://example.com:8443/metrics").unwrap();

        assert_eq!(parsed.path, "/metrics");
        assert_eq!(parsed.protocol.as_deref(), Some("https"));
        assert_eq!(parsed.host.as_deref(), Some("example.com:8443"));
        assert_eq!(parsed.hostname.as_deref(), Some("example.com"));
        assert_eq!(parsed.port, Some(8443));
    }

    #[test]
    fn parses_ipv4_address_and_port() {
        let parsed = parse_url("http://127.0.0.1:8080/status").unwrap();

        assert_eq!(parsed.path, "/status");
        assert_eq!(parsed.host.as_deref(), Some("127.0.0.1:8080"));
        assert_eq!(parsed.hostname.as_deref(), Some("127.0.0.1"));
        assert_eq!(parsed.port, Some(8080));
    }

    #[test]
    fn parses_ipv6_address_with_port() {
        let parsed = parse_url("https://[2001:db8::1]:3030/resource").unwrap();

        assert_eq!(parsed.path, "/resource");
        assert_eq!(parsed.host.as_deref(), Some("[2001:db8::1]:3030"));
        assert_eq!(parsed.hostname.as_deref(), Some("2001:db8::1"));
        assert_eq!(parsed.port, Some(3030));
    }

    #[test]
    fn parses_ipv6_address_without_port() {
        let parsed = parse_url("http://[2001:db8::2]/root").unwrap();

        assert_eq!(parsed.path, "/root");
        assert_eq!(parsed.host.as_deref(), Some("[2001:db8::2]"));
        assert_eq!(parsed.hostname.as_deref(), Some("2001:db8::2"));
        assert_eq!(parsed.port, None);
    }

    #[test]
    fn omits_query_when_absent() {
        let parsed = parse_url("https://example.org/features").unwrap();

        assert_eq!(parsed.path, "/features");
        assert_eq!(parsed.query, None);
    }

    #[test]
    fn preserves_percent_encoded_path_segments() {
        let parsed = parse_url("http://example.com/api%20space/encoded%2Fslash").unwrap();

        assert_eq!(parsed.path, "/api%20space/encoded%2Fslash");
    }

    #[test]
    fn parses_root_path_without_explicit_port() {
        let parsed = parse_url("http://example.com").unwrap();

        assert_eq!(parsed.path, "/");
        assert_eq!(parsed.query, None);
        assert_eq!(parsed.host.as_deref(), Some("example.com"));
        assert_eq!(parsed.hostname.as_deref(), Some("example.com"));
        assert_eq!(parsed.port, None);
    }

    #[test]
    fn preserves_empty_query_string() {
        let parsed = parse_url("https://example.com/path?").unwrap();

        assert_eq!(parsed.query.as_deref(), Some(""));
    }

    #[test]
    fn ignores_fragment_component() {
        let parsed = parse_url("https://example.com/path?foo=bar#section-2").unwrap();

        assert_eq!(parsed.path, "/path");
        assert_eq!(parsed.query.as_deref(), Some("foo=bar"));
    }

    #[test]
    fn parses_hostname_with_userinfo_and_port() {
        let parsed = parse_url("https://user:secret@example.net:9443/secure").unwrap();

        assert_eq!(parsed.path, "/secure");
        assert_eq!(parsed.host.as_deref(), Some("example.net:9443"));
        assert_eq!(parsed.hostname.as_deref(), Some("example.net"));
        assert_eq!(parsed.port, Some(9443));
    }

    #[test]
    fn handles_non_hierarchical_scheme_without_host() {
        let parsed = parse_url("mailto:john.doe@example.com").unwrap();

        assert_eq!(parsed.protocol.as_deref(), Some("mailto"));
        assert_eq!(parsed.path, "john.doe@example.com");
        assert_eq!(parsed.host, None);
        assert_eq!(parsed.hostname, None);
        assert_eq!(parsed.port, None);
    }

    #[test]
    fn returns_error_for_relative_url_without_scheme() {
        let err = parse_url("/only/path");

        assert!(matches!(err, Err(ParseError::RelativeUrlWithoutBase)));
    }
}
