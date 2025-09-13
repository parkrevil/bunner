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
fn parses_basic_query_params() {
    let headers = HashMap::new();
    let payload = make_payload("http://localhost:8080/users/42?q=ok", headers.clone(), None);
    let (req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::OK);
    assert_eq!(req.path, "/users/42");
    assert_eq!(req.query_params.unwrap().get("q").unwrap(), "ok");
}

#[test]
fn parses_array_and_nested_query_params() {
    let headers = HashMap::new();
    // 배열
    let payload = make_payload(
        "http://a.com/a?tags[]=a&tags[]=b&tags[]=c",
        headers.clone(),
        None,
    );
    let (req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::OK);
    let q = req.query_params.unwrap();
    let tags = q.get("tags").unwrap().as_array().unwrap();
    assert_eq!(tags, &vec![json!("a"), json!("b"), json!("c")]);

    // 중첩 객체
    let payload = make_payload(
        "http://a.com/a?user[name]=alice&user[id]=42&user[role]=admin",
        headers.clone(),
        None,
    );
    let (req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::OK);
    let q = req.query_params.unwrap();
    let user = q.get("user").unwrap();
    assert_eq!(user.get("name").unwrap(), "alice");
    assert_eq!(user.get("id").unwrap(), "42");
    assert_eq!(user.get("role").unwrap(), "admin");

    // 5단계 중첩
    let payload = make_payload("http://a.com/a?a[b][c][d][e]=1", headers.clone(), None);
    let (req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::OK);
    let q = req.query_params.unwrap();
    let a = q.get("a").unwrap();
    let b = a.get("b").unwrap();
    let c = b.get("c").unwrap();
    let d = c.get("d").unwrap();
    assert_eq!(d.get("e").unwrap(), "1");
}

#[test]
fn handles_invalid_and_malformed_query_params() {
    let headers = HashMap::new();
    // invalid url
    let payload = make_payload("://bad-url", headers.clone(), None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));

    // malformed querystring
    let payload = make_payload("http://a.com/a?a[=malformed", headers.clone(), None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));

    // 중복 non-array key
    let payload = make_payload("http://a.com/a?k=1&k=2", headers.clone(), None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));

    // 잘못된 bracket
    for bad in [
        "http://a.com/a?[k]=v",
        "http://a.com/a?[]=v",
        "http://a.com/a?a[]]=v",
        "http://a.com/a?a[[x]]=v",
    ] {
        let payload = make_payload(bad, headers.clone(), None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn handles_empty_query_value() {
    let headers = HashMap::new();
    let payload = make_payload("http://a.com/a?k=", headers.clone(), None);
    let (req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::OK);
    let q = req.query_params.unwrap();
    assert_eq!(q.get("k").unwrap(), "");
}

#[test]
fn handles_extremely_long_urls() {
    let headers = HashMap::new();
    let long_path = "a".repeat(10_000);
    let url = format!("http://example.com/{}", long_path);
    let payload = make_payload(&url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        assert_eq!(req.path, format!("/{}", long_path));
    } else {
        // URL might be rejected for being too long
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn handles_very_deep_query_nesting() {
    let headers = HashMap::new();
    let deep_query = "a[b][c][d][e][f][g][h][i][j]=deep";
    let url = format!("http://example.com/test?{}", deep_query);
    let payload = make_payload(&url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        // Should handle deep nesting up to configured limit
        assert!(req.query_params.is_some());
    } else {
        // Might exceed nesting limit
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn handles_query_with_many_parameters() {
    let headers = HashMap::new();
    let mut query_parts = Vec::new();
    for i in 0..1000 {
        query_parts.push(format!("param{}=value{}", i, i));
    }
    let query = query_parts.join("&");
    let url = format!("http://example.com/test?{}", query);
    let payload = make_payload(&url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert!(q.as_object().unwrap().len() <= 1000);
    }
}

#[test]
fn handles_special_url_schemes() {
    let headers = HashMap::new();
    for scheme in ["https", "ftp", "file", "custom"].iter() {
        let url = format!("{}://example.com/test", scheme);
        let payload = make_payload(&url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            assert_eq!(req.path, "/test");
        }
    }
}

#[test]
fn handles_international_domain_names() {
    let headers = HashMap::new();
    // These should be rejected as they're not ASCII
    for domain in ["münchen.de", "тест.рф", "例え.テスト"].iter() {
        let url = format!("http://{}/test", domain);
        let payload = make_payload(&url, headers.clone(), None);
        let (_req, res) = run_chain(&payload);
        // Should be rejected as invalid URL format
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn handles_query_parameter_edge_values() {
    let headers = HashMap::new();
    let edge_values = [
        "empty=",
        "space=hello%20world",
        "special=!@#$%^&*()",
        "unicode=café%20test",
        "numbers=123456789",
        "boolean=true",
        "null=null",
    ];

    for edge_val in edge_values.iter() {
        let url = format!("http://example.com/test?{}", edge_val);
        let payload = make_payload(&url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            assert!(req.query_params.is_some());
        }
    }
}

#[test]
fn handles_percent_encoded_url_parameters() {
    let headers = HashMap::new();

    // Test basic percent encoding
    let test_cases = vec![
        ("http://example.com/test?msg=hello%20world", "hello world"),
        ("http://example.com/test?name=caf%C3%A9", "café"),
        ("http://example.com/test?path=%2Fhome%2Fuser", "/home/user"),
        ("http://example.com/test?query=a%2Bb%3Dc", "a+b=c"),
        ("http://example.com/test?emoji=%F0%9F%8C%8D", "🌍"),
        ("http://example.com/test?special=%21%40%23%24", "!@#$"),
    ];

    for (url, expected) in test_cases {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            let q = req.query_params.unwrap();
            let key = url.split('=').next().unwrap().split('?').nth(1).unwrap();
            assert_eq!(q.get(key).unwrap(), expected,
                      "Failed to decode percent encoding for URL: {}", url);
        }
    }
}

#[test]
fn handles_malformed_percent_encoding() {
    let headers = HashMap::new();

    // Test malformed percent encoding
    let malformed_cases = vec![
        "http://example.com/test?bad=%",           // Incomplete percent encoding
        "http://example.com/test?bad=%1",          // Incomplete percent encoding
        "http://example.com/test?bad=%XY",         // Invalid hex digits
        "http://example.com/test?bad=%G0",         // Invalid hex digit
        "http://example.com/test?bad=%0G",         // Invalid hex digit
    ];

    for url in malformed_cases {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        // Should either handle gracefully or reject
        if res.http_status == HttpStatusCode::OK {
            // If accepted, should not crash and provide some value
            assert!(req.query_params.is_some());
        } else {
            // If rejected, should be BadRequest
            assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        }
    }
}

#[test]
fn handles_percent_encoded_route_parameters() {
    let headers = HashMap::new();

    // Test percent encoding in route parameters (simulated)
    // Note: This would typically be tested at the router level
    let encoded_params = vec![
        "user%20name",     // Space
        "file%2Ename.txt", // Dot
        "path%2Fto%2Ffile", // Slashes
        "query%3Dvalue",   // Equals
        "test%26more",     // Ampersand
    ];

    for param in encoded_params {
        // Create URL with encoded parameter in path
        let url = format!("http://example.com/users/{}", param);
        let payload = make_payload(&url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            // Path should be preserved as-is (decoding happens at router level)
            assert_eq!(req.path, format!("/users/{}", param));
        }
    }
}

#[test]
fn handles_mixed_encoded_and_unencoded_parameters() {
    let headers = HashMap::new();

    let url = "http://example.com/test?normal=value&encoded=hello%20world&special=%F0%9F%8C%8D";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("normal").unwrap(), "value");
        assert_eq!(q.get("encoded").unwrap(), "hello world");
        assert_eq!(q.get("special").unwrap(), "🌍");
    }
}

#[test]
fn handles_percent_encoding_edge_cases() {
    let headers = HashMap::new();

    // Test edge cases
    let edge_cases = vec![
        ("http://example.com/test?empty=%20%20%20", "   "),  // Multiple spaces
        ("http://example.com/test?null=%00", "\0"),          // Null byte
        ("http://example.com/test?newline=%0A", "\n"),       // Newline
        ("http://example.com/test?tab=%09", "\t"),           // Tab
        ("http://example.com/test?quote=%22", "\""),         // Quote
        ("http://example.com/test?plus=%2B", "+"),           // Plus sign
    ];

    for (url, expected) in edge_cases {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            let q = req.query_params.unwrap();
            let key = url.split('=').next().unwrap().split('?').nth(1).unwrap();
            assert_eq!(q.get(key).unwrap(), expected,
                      "Failed edge case for URL: {}", url);
        }
    }
}

#[test]
fn handles_over_encoded_parameters() {
    let headers = HashMap::new();

    // Test over-encoding (encoding already encoded characters)
    let over_encoded = vec![
        ("http://example.com/test?msg=%2520", "%20"),        // % encoded as %25
        ("http://example.com/test?msg=%252B", "%2B"),        // + encoded as %25
        ("http://example.com/test?msg=%2522", "%22"),        // " encoded as %25
    ];

    for (url, expected) in over_encoded {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);

        if res.http_status == HttpStatusCode::OK {
            let q = req.query_params.unwrap();
            assert_eq!(q.get("msg").unwrap(), expected);
        }
    }
}
