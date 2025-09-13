use bunner_http_server::enums::{HttpMethod, HttpStatusCode};
use bunner_http_server::middleware::{
    body_parser::BodyParser, chain::Chain, cookie_parser::CookieParser,
    header_parser::HeaderParser, url_parser::UrlParser,
};
use bunner_http_server::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::json;
use std::collections::HashMap;

fn make_payload(
    url: &str,
    headers: HashMap<String, String>,
    body: Option<&str>,
) -> HandleRequestPayload {
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
        path: String::new(),
        headers: HashMap::new(),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: None,
        content_length: None,
        charset: None,
        params: None,
        query_params: None,
        body: None,
    };
    let mut res = BunnerResponse {
        http_status: HttpStatusCode::OK,
        headers: None,
        body: serde_json::Value::Null,
    };
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);
    let _ = chain.execute(&mut req, &mut res, payload);
    (req, res)
}

#[test]
fn parses_content_type_and_charset() {
    let mut headers = HashMap::new();
    headers.insert(
        "content-type".to_string(),
        "application/json; charset=utf-8".to_string(),
    );
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.content_type.unwrap(), "application/json");
    assert_eq!(req.charset.unwrap(), "utf-8");
}

#[test]
fn handles_extremely_long_headers() {
    let mut headers = HashMap::new();
    let long_value = "x".repeat(100_000);
    headers.insert("x-long-header".to_string(), long_value.clone());
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.headers.get("x-long-header").unwrap(), &long_value);
}

#[test]
fn handles_many_headers() {
    let mut headers = HashMap::new();
    for i in 0..1000 {
        headers.insert(format!("x-header-{}", i), format!("value-{}", i));
    }
    let payload = make_payload("http://localhost/a", headers.clone(), None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.headers.len(), headers.len());
}

#[test]
fn handles_duplicate_content_type_parameters() {
    let mut headers = HashMap::new();
    headers.insert(
        "content-type".to_string(),
        "application/json; charset=utf-8; charset=iso-8859-1; boundary=something".to_string(),
    );
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    // Should use the first charset found
    assert_eq!(req.content_type.unwrap(), "application/json");
    assert_eq!(req.charset.unwrap(), "utf-8");
}

#[test]
fn handles_malformed_content_type() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), ";;invalid;;".to_string());
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.content_type.unwrap(), ";;invalid;;");
}

#[test]
fn handles_content_length_edge_cases() {
    let mut headers = HashMap::new();
    // Test various content-length values
    for cl_value in ["0", "999999999999", "invalid", "", "-1"] {
        headers.clear();
        headers.insert("content-length".to_string(), cl_value.to_string());
        let payload = make_payload("http://localhost/a", headers.clone(), None);
        let (req, _res) = run_chain(&payload);

        if cl_value.parse::<u64>().is_ok() {
            assert!(req.content_length.is_some());
        } else {
            assert_eq!(req.content_length, Some(0)); // Fallback to 0 for invalid
        }
    }
}
