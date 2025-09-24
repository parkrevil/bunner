#[cfg(test)]
mod handle {
    use crate::enums::{HttpMethod, HttpStatusCode};
    use crate::middlewares::Middleware;
    use crate::middlewares::header_parser::HeaderParser;
    use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload, RequestMetadata};
    use serde_json::{Map, Value};
    use std::collections::HashMap;

    fn build_request() -> BunnerRequest {
        BunnerRequest {
            request_id: "req-1".to_string(),
            http_method: HttpMethod::Get,
            url: "/".to_string(),
            path: "/".to_string(),
            query_string: None,
            headers: HashMap::new(),
            protocol: None,
            host: None,
            hostname: None,
            port: None,
            ip: None,
            ips: Vec::new(),
            is_trusted_proxy: false,
            subdomains: Vec::new(),
            cookies: Value::Object(Map::new()),
            content_type: None,
            content_length: None,
            charset: None,
            params: Value::Object(Map::new()),
            query_params: Value::Object(Map::new()),
            body: None,
        }
    }

    fn build_response() -> BunnerResponse {
        BunnerResponse {
            http_status: HttpStatusCode::OK,
            headers: None,
            body: Value::Null,
        }
    }

    fn build_payload(headers: &[(&str, &str)]) -> HandleRequestPayload {
        HandleRequestPayload {
            http_method: HttpMethod::Get as u8,
            url: "/".to_string(),
            headers: headers
                .iter()
                .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                .collect(),
            body: None,
            request: RequestMetadata::default(),
        }
    }

    #[test]
    fn trust_proxy_false_prefers_host_header() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("host", "example.com"), ("forwarded", "for=1.1.1.1")]);

        let mut req = build_request();
        let mut res = build_response();

        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.protocol, None);
        assert_eq!(req.host.as_deref(), Some("example.com"));
        assert_eq!(req.hostname.as_deref(), Some("example.com"));
        assert_eq!(req.port, None);
        assert_eq!(
            req.headers.get("host").map(|s| s.as_str()),
            Some("example.com")
        );
        assert!(req.subdomains.is_empty());
    }

    #[test]
    fn trust_proxy_true_uses_forwarded_values() {
        let parser = HeaderParser::new(true);
        let payload = build_payload(&[("forwarded", "for=10.0.0.1; host=proxy.app; proto=https")]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.protocol.as_deref(), Some("https"));
        assert_eq!(req.host.as_deref(), Some("proxy.app"));
        assert_eq!(req.hostname.as_deref(), Some("proxy.app"));
    }

    #[test]
    fn trust_proxy_true_falls_back_to_x_forwarded_headers() {
        let parser = HeaderParser::new(true);
        let payload = build_payload(&[
            ("x-forwarded-proto", "HTTPS, HTTP"),
            ("x-forwarded-host", "edge.example.com, example.com"),
        ]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.protocol.as_deref(), Some("https"));
        assert_eq!(req.host.as_deref(), Some("edge.example.com"));
        assert_eq!(req.hostname.as_deref(), Some("edge.example.com"));
    }

    #[test]
    fn trust_proxy_true_falls_back_to_host_header_when_forwarded_missing_host() {
        let parser = HeaderParser::new(true);
        let payload = build_payload(&[
            ("forwarded", "for=10.0.0.8"),
            ("x-forwarded-proto", "https"),
            ("host", "origin.example.com"),
        ]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.protocol.as_deref(), Some("https"));
        assert_eq!(req.host.as_deref(), Some("origin.example.com"));
        assert_eq!(req.hostname.as_deref(), Some("origin.example.com"));
    }

    #[test]
    fn trust_proxy_false_ignores_forwarded_headers() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[
            ("forwarded", "for=10.0.0.9; host=proxy.example"),
            ("x-forwarded-proto", "https"),
            ("x-forwarded-host", "edge.example.com"),
            ("host", "service.internal"),
        ]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.protocol, None);
        assert_eq!(req.host.as_deref(), Some("service.internal"));
        assert_eq!(req.hostname.as_deref(), Some("service.internal"));
    }

    #[test]
    fn trust_proxy_true_sets_subdomains_from_forwarded_host() {
        let parser = HeaderParser::new(true);
        let payload = build_payload(&[(
            "forwarded",
            "for=10.0.0.10; host=app.api.eu.example.com; proto=https",
        )]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.host.as_deref(), Some("app.api.eu.example.com"));
        assert_eq!(
            req.subdomains,
            vec!["app".to_string(), "api".to_string(), "eu".to_string()]
        );
    }

    #[test]
    fn parses_content_type_and_charset() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("content-type", "text/html; charset=UTF-8")]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.content_type.as_deref(), Some("text/html"));
        assert_eq!(req.charset.as_deref(), Some("UTF-8"));
    }

    #[test]
    fn keeps_raw_content_type_when_parse_fails() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("content-type", " ; ; invalid")]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.content_type.as_deref(), Some("; ; invalid"));
        assert_eq!(req.charset, None);
    }

    #[test]
    fn parses_valid_content_length() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("content-length", "512")]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.content_length, Some(512));
    }

    #[test]
    fn ignores_invalid_content_length() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("content-length", "not-a-number")]);

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.content_length, None);
    }

    #[test]
    fn clones_all_headers_and_resets_invalid_content_length() {
        let parser = HeaderParser::new(false);
        let payload = build_payload(&[("content-length", "invalid"), ("x-custom", "present")]);

        let mut req = build_request();
        req.content_length = Some(2048);
        req.headers.insert("stale".to_string(), "keep".to_string());
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.content_length, None);
        assert_eq!(
            req.headers.get("content-length").map(|s| s.as_str()),
            Some("invalid")
        );
        assert_eq!(
            req.headers.get("x-custom").map(|s| s.as_str()),
            Some("present")
        );
        assert!(!req.headers.contains_key("stale"));
    }
}
