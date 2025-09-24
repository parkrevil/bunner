#[cfg(test)]
mod handle {
    use super::super::CookieParser;
    use crate::enums::{HttpMethod, HttpStatusCode};
    use crate::middlewares::Middleware;
    use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload, RequestMetadata};
    use serde_json::Value;
    use std::collections::HashMap;

    fn build_request_with_header(cookie: Option<&str>) -> BunnerRequest {
        let mut headers = HashMap::new();
        if let Some(value) = cookie {
            headers.insert("cookie".to_string(), value.to_string());
        }

        BunnerRequest {
            request_id: "req-1".to_string(),
            http_method: HttpMethod::Get,
            url: "/".to_string(),
            path: "/".to_string(),
            query_string: None,
            headers,
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

    fn build_payload(cookie: Option<&str>) -> HandleRequestPayload {
        let mut headers = HashMap::new();
        if let Some(value) = cookie {
            headers.insert("cookie".to_string(), value.to_string());
        }

        HandleRequestPayload {
            http_method: HttpMethod::Get as u8,
            url: "/".to_string(),
            headers,
            body: None,
            request: RequestMetadata::default(),
        }
    }

    #[test]
    fn populates_request_cookies_when_header_present() {
        let parser = CookieParser;
        let mut req = build_request_with_header(Some("a=1; b=two"));
        let mut res = build_response();

        let payload = build_payload(Some("a=1; b=two"));
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        let expected = serde_json::json!({
            "a": "1",
            "b": "two"
        });
        assert_eq!(req.cookies, expected);
    }

    #[test]
    fn leaves_request_cookies_unchanged_when_header_absent() {
        let parser = CookieParser;
        let mut req = build_request_with_header(None);
        let mut res = build_response();

        let payload = build_payload(None);
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.cookies, Value::Null);
    }

    #[test]
    fn leaves_existing_cookies_when_header_absent() {
        let parser = CookieParser;
        let mut req = build_request_with_header(None);
        req.cookies = serde_json::json!({ "existing": "data" });
        let mut res = build_response();

        let payload = build_payload(None);
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.cookies, serde_json::json!({ "existing": "data" }));
    }

    #[test]
    fn overwrites_existing_cookies_with_parsed_values() {
        let parser = CookieParser;
        let mut req = build_request_with_header(Some("session=new; theme=dark"));
        req.cookies = serde_json::json!({ "stale": "value" });
        let mut res = build_response();

        let payload = build_payload(Some("session=new; theme=dark"));
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        let expected = serde_json::json!({
            "session": "new",
            "theme": "dark"
        });
        assert_eq!(req.cookies, expected);
    }

    #[test]
    fn sets_empty_object_when_header_has_only_invalid_segments() {
        let parser = CookieParser;
        let mut req = build_request_with_header(Some("invalid; another"));
        req.cookies = serde_json::json!({ "stale": "value" });
        let mut res = build_response();

        let payload = build_payload(Some("invalid; another"));
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.cookies, serde_json::json!({}));
    }

    #[test]
    fn sets_empty_object_when_cookie_header_whitespace_only() {
        let parser = CookieParser;
        let mut req = build_request_with_header(Some("   "));
        req.cookies = serde_json::json!({ "previous": "value" });
        let mut res = build_response();

        let payload = build_payload(Some("   "));
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.cookies, serde_json::json!({}));
    }

    #[test]
    fn returns_true_when_header_absent() {
        let parser = CookieParser;
        let mut req = build_request_with_header(None);
        let mut res = build_response();

        let continued = parser.handle(&mut req, &mut res, &build_payload(None));

        assert!(continued);
    }

    #[test]
    fn keeps_existing_cookies_when_req_headers_missing_cookie_key() {
        let parser = CookieParser;
        let mut req = build_request_with_header(None);
        req.cookies = serde_json::json!({ "keep": "me" });
        let mut res = build_response();

        let payload = build_payload(Some("session=abc"));
        let continued = parser.handle(&mut req, &mut res, &payload);

        assert!(continued);
        assert_eq!(req.cookies, serde_json::json!({ "keep": "me" }));
    }

    #[test]
    fn does_not_mutate_request_headers() {
        let parser = CookieParser;
        let mut req = build_request_with_header(Some("token=abc"));
        let mut res = build_response();

        let original_headers = req.headers.clone();
        let payload = build_payload(Some("token=abc"));
        parser.handle(&mut req, &mut res, &payload);

        assert_eq!(req.headers, original_headers);
    }
}
