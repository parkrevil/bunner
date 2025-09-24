#[cfg(test)]
mod handle {
    use crate::enums::{HttpMethod, HttpStatusCode};
    use crate::middlewares::{Middleware, UrlParser};
    use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload, RequestMetadata};
    use serde_json::Value;
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
            cookies: Value::Null,
            content_type: None,
            content_length: None,
            charset: None,
            params: Value::Object(Default::default()),
            query_params: Value::Object(Default::default()),
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

    fn build_payload(url: &str) -> HandleRequestPayload {
        HandleRequestPayload {
            http_method: HttpMethod::Get as u8,
            url: url.to_string(),
            headers: HashMap::new(),
            body: None,
            request: RequestMetadata::default(),
        }
    }

    #[test]
    fn populates_request_when_url_valid() {
        let parser = UrlParser;
        let payload = build_payload("https://example.com:4443/products?filter=all");

        let mut req = build_request();
        let mut res = build_response();

        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.path, "/products");
        assert_eq!(req.query_string.as_deref(), Some("filter=all"));
        assert_eq!(req.protocol.as_deref(), Some("https"));
        assert_eq!(req.host.as_deref(), Some("example.com:4443"));
        assert_eq!(req.hostname.as_deref(), Some("example.com"));
        assert_eq!(req.port, Some(4443));
    }

    #[test]
    fn preserves_existing_request_fields() {
        let parser = UrlParser;
        let payload = build_payload("https://override.test:8443/api?foo=bar");

        let mut req = build_request();
        req.protocol = Some("http".to_string());
        req.host = Some("cached.host".to_string());
        req.hostname = Some("cached.host".to_string());
        req.port = Some(8080);
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.path, "/api");
        assert_eq!(req.query_string.as_deref(), Some("foo=bar"));
        assert_eq!(req.protocol.as_deref(), Some("http"));
        assert_eq!(req.host.as_deref(), Some("cached.host"));
        assert_eq!(req.hostname.as_deref(), Some("cached.host"));
        assert_eq!(req.port, Some(8080));
    }

    #[test]
    fn rejects_request_on_parse_error() {
        let parser = UrlParser;
        let payload = build_payload("/relative/path");

        let mut req = build_request();
        let original_path = req.path.clone();
        let mut res = build_response();

        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(!continued);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, Value::String("Bad Request".to_string()));
        assert_eq!(req.path, original_path);
        assert_eq!(req.query_string, None);
    }

    #[test]
    fn fills_missing_hostname_without_overwriting_host() {
        let parser = UrlParser;
        let payload = build_payload("https://example.com:9000/catalog");

        let mut req = build_request();
        req.host = Some("existing.host".to_string());
        req.hostname = None;
        req.port = None;
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.host.as_deref(), Some("existing.host"));
        assert_eq!(req.hostname.as_deref(), Some("example.com"));
        assert_eq!(req.port, Some(9000));
    }

    #[test]
    fn clears_query_string_when_missing_in_url() {
        let parser = UrlParser;
        let payload = build_payload("https://example.org/status");

        let mut req = build_request();
        req.query_string = Some("stale=true".to_string());
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.path, "/status");
        assert_eq!(req.query_string, None);
    }

    #[test]
    fn skips_host_population_for_hostless_scheme() {
        let parser = UrlParser;
        let payload = build_payload("mailto:john.doe@example.com");

        let mut req = build_request();
        let mut res = build_response();

        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.path, "john.doe@example.com");
        assert_eq!(req.query_string, None);
        assert_eq!(req.host, None);
        assert_eq!(req.hostname, None);
        assert_eq!(req.port, None);
    }

    #[test]
    fn overwrites_response_body_on_rejection() {
        let parser = UrlParser;
        let payload = build_payload("relative/no-scheme");

        let mut req = build_request();
        let mut res = build_response();
        res.body = Value::String("previous body".to_string());

        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(!continued);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, Value::String("Bad Request".to_string()));
    }
}
