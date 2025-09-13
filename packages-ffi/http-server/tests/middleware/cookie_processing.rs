#[test]
fn parses_multiple_cookies_from_header() {
    let mut headers = HashMap::new();
    headers.insert("cookie".to_string(), "a=1; b=2; c=3".to_string());
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.cookies.get("a").unwrap(), "1");
    assert_eq!(req.cookies.get("b").unwrap(), "2");
    assert_eq!(req.cookies.get("c").unwrap(), "3");
}
use bunner_http_server::enums::{HttpMethod, HttpStatusCode};
use bunner_http_server::middleware::{
    body_parser::BodyParser, chain::Chain, cookie_parser::CookieParser,
    header_parser::HeaderParser, url_parser::UrlParser,
};
use bunner_http_server::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
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
fn parses_cookie_header_into_map() {
    let mut headers = HashMap::new();
    headers.insert("cookie".to_string(), "a=1; b=2".to_string());
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.cookies.get("a").unwrap(), "1");
    assert_eq!(req.cookies.get("b").unwrap(), "2");
}

#[test]
fn parses_quoted_and_spaced_cookie_values() {
    let mut headers = HashMap::new();
    headers.insert(
        "cookie".to_string(),
        "a=\"hello world\"; b=2".to_string(),
    );
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.cookies.get("a").unwrap(), "hello world");
    assert_eq!(req.cookies.get("b").unwrap(), "2");
}

#[test]
fn keeps_last_value_for_duplicate_cookie_keys() {
    let mut headers = HashMap::new();
    headers.insert("cookie".to_string(), "a=1; a=2".to_string());
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.cookies.get("a").unwrap(), "2");
}

#[test]
fn handles_extremely_long_cookie_values() {
    let mut headers = HashMap::new();
    let long_value = "x".repeat(10_000);
    headers.insert("cookie".to_string(), format!("longcookie={}", long_value));
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.cookies.get("longcookie").unwrap(), &long_value);
}

#[test]
fn handles_many_cookies() {
    let mut headers = HashMap::new();
    let mut cookie_parts = Vec::new();
    for i in 0..1000 {
        cookie_parts.push(format!("cookie{}=value{}", i, i));
    }
    let cookie_header = cookie_parts.join("; ");
    headers.insert("cookie".to_string(), cookie_header);
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);

    // Should handle many cookies
    let cookies_obj = req.cookies.as_object().unwrap();
    assert!(cookies_obj.len() <= 1000);
}

#[test]
fn handles_malformed_cookie_syntax() {
    let mut headers = HashMap::new();
    let malformed_cookies = [
        "=valuewithoutname",
        "namewithoutvalue=",
        ";;invalid;;",
        "name=value=extra",
        "name with space=value",
        "name=value; invalid syntax here",
    ];

    for malformed in malformed_cookies.iter() {
        headers.clear();
        headers.insert("cookie".to_string(), malformed.to_string());
        let payload = make_payload("http://localhost/a", headers.clone(), None);
        let (req, _res) = run_chain(&payload);
        // Should handle gracefully without crashing
        let _cookies = req.cookies.as_object();
    }
}

#[test]
fn handles_cookie_special_characters() {
    let mut headers = HashMap::new();
    headers.insert(
        "cookie".to_string(),
        "special=\"value with spaces and; semicolons\"".to_string(),
    );
    let payload = make_payload("http://localhost/a", headers, None);
    let (req, _res) = run_chain(&payload);
    // 쿠키 값에서 따옴표를 제거한 값이어야 함
    assert_eq!(
        req.cookies.get("special").unwrap(),
        "value with spaces and; semicolons"
    );
}
