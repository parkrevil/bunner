use super::forwarded;

#[cfg(test)]
mod parse_forwarded_values {
    use super::forwarded::parse_forwarded_values;

    #[test]
    fn parses_basic_forwarded_values() {
        let values = parse_forwarded_values("for=192.0.2.60; proto=HTTPS; host=example.com");

        assert_eq!(values.client.as_deref(), Some("192.0.2.60"));
        assert_eq!(values.proto.as_deref(), Some("https"));
        assert_eq!(values.host.as_deref(), Some("example.com"));
    }

    #[test]
    fn strips_quotes_and_normalizes_proto() {
        let values = parse_forwarded_values(
            "for=\"  [2001:db8::1] \"; proto=\"Http\"; host=\" Example.com \"",
        );

        assert_eq!(values.client.as_deref(), Some("[2001:db8::1]"));
        assert_eq!(values.proto.as_deref(), Some("http"));
        assert_eq!(values.host.as_deref(), Some("Example.com"));
    }

    #[test]
    fn ignores_unknown_keys_and_empty_segments() {
        let values =
            parse_forwarded_values("proto=https; ; foo=bar; host=example.com; ; for=client");

        assert_eq!(values.proto.as_deref(), Some("https"));
        assert_eq!(values.host.as_deref(), Some("example.com"));
        assert_eq!(values.client.as_deref(), Some("client"));
    }

    #[test]
    fn uses_only_first_forwarded_element() {
        let values = parse_forwarded_values("for=client1; proto=https, for=client2; proto=http");

        assert_eq!(values.client.as_deref(), Some("client1"));
        assert_eq!(values.proto.as_deref(), Some("https"));
    }

    #[test]
    fn handles_missing_or_empty_values() {
        let values = parse_forwarded_values("for=; proto=; host=");

        assert_eq!(values.client.as_deref(), Some(""));
        assert_eq!(values.proto.as_deref(), Some(""));
        assert_eq!(values.host.as_deref(), Some(""));
    }

    #[test]
    fn returns_default_for_empty_header() {
        let values = parse_forwarded_values("");

        assert!(values.client.is_none());
        assert!(values.host.is_none());
        assert!(values.proto.is_none());
    }

    #[test]
    fn parses_case_insensitive_keys() {
        let values = parse_forwarded_values("PROTO=HTTPS; HOST=Example.org; FOR=Client");

        assert_eq!(values.proto.as_deref(), Some("https"));
        assert_eq!(values.host.as_deref(), Some("Example.org"));
        assert_eq!(values.client.as_deref(), Some("Client"));
    }
}
