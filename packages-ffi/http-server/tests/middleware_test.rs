use bunner_http_server::middleware::body_parser::BodyParser;
use bunner_http_server::middleware::chain::Chain;
use bunner_http_server::middleware::cookie_parser::CookieParser;
use bunner_http_server::middleware::header_parser::HeaderParser;
use bunner_http_server::middleware::url_parser::UrlParser;
use bunner_http_server::r#enum::HttpMethod;
use bunner_http_server::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::json;
use std::collections::HashMap;

fn make_payload(url: &str, headers: HashMap<String, String>, body: Option<&str>) -> HandleRequestPayload {
    HandleRequestPayload {
        http_method: 0,
        url: url.to_string(),
        headers,
        body: body.map(|s| s.to_string()),
    }
}

fn run_chain(payload: &HandleRequestPayload) -> (BunnerRequest, BunnerResponse) {
    let mut req = BunnerRequest {
        url: String::new(),
        http_method: HttpMethod::Get,
        host: String::new(),
        hostname: String::new(),
        port: None,
        path: String::new(),
        params: None,
        query_params: None,
        body: None,
        ip: String::new(),
        ip_version: 0,
        http_protocol: String::new(),
        http_version: String::new(),
        headers: serde_json::Value::Object(serde_json::Map::new()),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: String::new(),
        charset: String::new(),
    };
    let mut res = BunnerResponse { http_status: 200, headers: None, body: serde_json::Value::Null };
    let chain = Chain::new().with(HeaderParser).with(UrlParser).with(CookieParser).with(BodyParser);
    chain.execute(&mut req, &mut res, payload);
    (req, res)
}

mod header_parsing {
    use super::*;

    #[test]
    fn should_lowercase_headers_and_set_protocol_version_ip() {
        let mut headers = HashMap::new();
        headers.insert("X-Forwarded-Proto".to_string(), "https".to_string());
        headers.insert("X-Real-IP".to_string(), "1.2.3.4".to_string());
        let payload = make_payload("https://example.com/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.http_protocol, "https");
        assert_eq!(req.http_version, "1.1");
        assert_eq!(req.ip, "1.2.3.4");
        assert_eq!(req.ip_version, 4);
    }

    #[test]
    fn should_parse_content_type_and_charset() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json; charset=utf-8".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.content_type, "application/json");
        assert_eq!(req.charset, "utf-8");
    }

    #[test]
    fn should_trim_and_pick_first_ip_from_x_forwarded_for() {
        let mut headers = HashMap::new();
        headers.insert("x-forwarded-for".to_string(), " 1.1.1.1 , 2.2.2.2 ".to_string());
        let payload = make_payload("http://a.com/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.ip, "1.1.1.1");
    }

    #[test]
    fn should_detect_ipv4_mapped_ipv6_as_ipv6_version() {
        let mut headers = HashMap::new();
        headers.insert("x-real-ip".to_string(), "::ffff:192.0.2.128".to_string());
        let payload = make_payload("http://a.com/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.ip, "::ffff:192.0.2.128");
        assert_eq!(req.ip_version, 6);
    }

    #[test]
    fn should_fallback_protocol_from_url_scheme_when_header_missing() {
        let headers = HashMap::new();
        let payload = make_payload("https://a.com/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.http_protocol, "https");
    }
}

mod url_parsing {
    use super::*;

    #[test]
    fn should_parse_path_query_and_host_parts() {
        let headers = HashMap::new();
        let payload = make_payload("http://localhost:8080/users/42?q=ok", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.path, "/users/42");
        assert_eq!(req.query_params.unwrap().get("q").unwrap(), "ok");
        assert_eq!(req.hostname, "localhost");
        assert_eq!(req.port, Some(8080));
    }

    #[test]
    fn should_keep_duplicate_query_last_value() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?k=1&k=2", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.query_params.unwrap().get("k").unwrap(), "2");
    }

    #[test]
    fn should_allow_empty_keys_or_values_in_query() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?=v&k=", headers, None);
        let (req, _res) = run_chain(&payload);
        let q = req.query_params.unwrap();
        assert_eq!(q.get("").unwrap(), "v");
        assert_eq!(q.get("k").unwrap(), "");
    }
}

mod cookie_parsing {
    use super::*;

    #[test]
    fn should_parse_cookie_header_into_map() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=1; b=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "1");
        assert_eq!(req.cookies.get("b").unwrap(), "2");
    }

    #[test]
    fn should_handle_quoted_and_spaced_cookie_values() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=\"hello world\"; b=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "hello world");
        assert_eq!(req.cookies.get("b").unwrap(), "2");
    }

    #[test]
    fn should_keep_last_value_for_duplicate_cookie_keys() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=1; a=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "2");
    }
}

mod body_parsing {
    use super::*;

    #[test]
    fn should_parse_json_body_when_content_type_is_json() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json; charset=utf-8".to_string());
        let payload = make_payload("http://localhost/a", headers, Some("{\"k\":1}"));
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.body.unwrap().get("k").unwrap(), 1);
        assert_eq!(req.charset, "utf-8");
    }

    #[test]
    fn should_keep_plain_text_body_when_non_json() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "text/plain".to_string());
        let payload = make_payload("http://localhost/a", headers, Some("hello"));
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.body.unwrap(), json!("hello"));
    }

    #[test]
    fn should_fallback_to_string_when_json_content_type_but_invalid_json() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());
        let payload = make_payload("http://localhost/a", headers, Some("{invalid}"));
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.body.unwrap(), json!("{invalid}"));
    }
}

