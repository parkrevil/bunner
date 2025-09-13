/*
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

#[test]
fn handles_plus_vs_space_semantics() {
    let headers = HashMap::new();
    let url = "http://example.com/test?plus=1+2";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        // Strict expectation: '+' should be interpreted as space (www-form semantics)
        assert_eq!(q.get("plus").unwrap(), "1 2");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_empty_keys_and_weird_delimiters() {
    let headers = HashMap::new();
    for bad in [
        "http://a.com/a?=novalue",
        "http://a.com/a?&&&&",
        "http://a.com/a?b==d",
        "http://a.com/a?&=1",
    ] {
        let payload = make_payload(bad, headers.clone(), None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_conflicting_scalar_and_object_for_same_key() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a=1&a[b]=2";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn strict_rejects_sparse_or_non_numeric_array_indices() {
    let headers = HashMap::new();
    // Sparse indices
    let url_sparse = "http://a.com/a?arr[0]=a&arr[2]=c";
    let payload = make_payload(url_sparse, headers.clone(), None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);

    // Negative index
    let url_negative = "http://a.com/a?arr[-1]=x";
    let payload = make_payload(url_negative, headers.clone(), None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);

    // Non-numeric index
    let url_nonnumeric = "http://a.com/a?arr[foo]=x";
    let payload = make_payload(url_nonnumeric, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn duplicates_on_nested_path_become_array() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a[b]=1&a[b]=2";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        let a = q.get("a").unwrap();
        let b = a.get("b").unwrap();
        let arr = b.as_array().expect("expected array for duplicated nested key");
        assert_eq!(arr, &vec![json!("1"), json!("2")]);
    } else {
        // Strict: prefer structures over conflicts; some implementations may reject
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_mixed_array_and_scalar_for_same_key() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a[]=1&a=2";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn parses_array_of_objects_without_indices() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a[][b]=1&a[][b]=2";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        let a = q.get("a").unwrap();
        let arr = a.as_array().expect("expected array for a[]");
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0].get("b").unwrap(), "1");
        assert_eq!(arr[1].get("b").unwrap(), "2");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn decodes_encoded_brackets_in_keys() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a%5Bb%5D=c"; // a[b]=c
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("a").unwrap().get("b").unwrap(), "c");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn treats_dots_in_keys_as_literal() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a.b=c";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("a.b").unwrap(), "c");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn supports_unicode_keys_and_values_percent_encoded() {
    let headers = HashMap::new();
    // key = "ключ" (Russian), value = "значение"
    let url = "http://example.com/test?%D0%BA%D0%BB%D1%8E%D1%87=%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D0%B5";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("ключ").unwrap(), "значение");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn decodes_equals_in_key_name() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a%3Db=c"; // key: a=b
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("a=b").unwrap(), "c");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn ignores_fragment_when_parsing_query() {
    let headers = HashMap::new();
    let url = "http://example.com/test?k=v#fragment";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("k").unwrap(), "v");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_incomplete_multibyte_percent_sequence() {
    let headers = HashMap::new();
    let url = "http://example.com/test?bad=%E2%82";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn handles_empty_query_and_key_without_value() {
    let headers = HashMap::new();
    // Empty query
    let url_empty = "http://a.com/a?";
    let payload = make_payload(url_empty, headers.clone(), None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.as_object().unwrap().len(), 0);
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }

    // Key presence without '=' should be treated as empty string value
    let url_flag = "http://a.com/a?flag";
    let payload = make_payload(url_flag, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("flag").unwrap(), "");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn preserves_multiple_equals_in_value() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a=b=c=d";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("a").unwrap(), "b=c=d");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn decodes_ampersand_in_value() {
    let headers = HashMap::new();
    let url = "http://a.com/a?v=a%26b%26c";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("v").unwrap(), "a&b&c");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_prototype_pollution_like_keys() {
    let headers = HashMap::new();
    for bad in [
        "http://a.com/a?__proto__[polluted]=yes",
        "http://a.com/a?constructor[prototype]=x",
    ] {
        let payload = make_payload(bad, headers.clone(), None);
        let (_req, res) = run_chain(&payload);
        // Strict security posture: reject these patterns
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_duplicate_scalar_keys_without_brackets() {
    let headers = HashMap::new();
    let url = "http://a.com/a?k=1&k=2&k=3";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn supports_encoded_emoji_keys_and_values() {
    let headers = HashMap::new();
    // key = 🐶, value = 💕
    let url = "http://example.com/test?%F0%9F%90%B6=%F0%9F%92%95";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("🐶").unwrap(), "💕");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_invalid_utf8_sequences() {
    let headers = HashMap::new();
    // %C3 followed by '(' is invalid
    let url = "http://example.com/test?name=%C3(";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn strict_rejects_mixed_indexing_forms() {
    let headers = HashMap::new();
    // a[] with explicit index later is inconsistent
    let url = "http://a.com/a?a[]=x&a[0]=y";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn nested_arrays_without_indices() {
    let headers = HashMap::new();
    // a[][] forms array of arrays
    let url = "http://a.com/a?a[][]=1&a[][]=2";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        let a = q.get("a").unwrap();
        let arr = a.as_array().unwrap();
        assert!(arr.iter().all(|v| v.is_array()));
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn strict_rejects_bracket_only_keys() {
    let headers = HashMap::new();
    let cases = ["http://a.com/a?[]=v", "http://a.com/a?[x]=v"]; 
    for url in cases {
        let payload = make_payload(url, headers.clone(), None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn keys_with_whitespace_characters() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a%20b=1&a%09c=2"; // space and tab in keys
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("a b").unwrap(), "1");
        assert_eq!(q.get("a\tc").unwrap(), "2");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn trailing_delimiters_are_tolerated_or_rejected() {
    let headers = HashMap::new();
    for url in ["http://a.com/a?a=1&", "http://a.com/a?a=1;"] {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);
        if res.http_status == HttpStatusCode::OK {
            let q = req.query_params.unwrap();
            assert_eq!(q.get("a").unwrap(), "1");
        } else {
            assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        }
    }
}

#[test]
fn order_sensitivity_mixed_scalar_and_array() {
    let headers = HashMap::new();
    // Opposite order of rejects_mixed_array_and_scalar_for_same_key
    let url = "http://a.com/a?a=2&a[]=1";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    // Strictly reject; some parsers might allow and coerce
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn duplicate_numeric_array_index_conflict() {
    let headers = HashMap::new();
    let url = "http://a.com/a?arr[0]=a&arr[0]=b";
    let payload = make_payload(url, headers, None);
    let (_req, res) = run_chain(&payload);
    // Conflict on same explicit index should be rejected under strict rules
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn lowercase_percent_encoding_equivalence() {
    let headers = HashMap::new();
    // same as café but with lowercase hex digits
    let url = "http://example.com/test?name=caf%c3%a9";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        assert_eq!(q.get("name").unwrap(), "café");
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn plus_and_ampersand_in_keys() {
    let headers = HashMap::new();
    // '+' in key should become space; encoded '&' should be literal in key
    let cases = vec![
        ("http://a.com/a?a+b=1", "a b", "1"),
        ("http://a.com/a?a%26b=2", "a&b", "2"),
    ];
    for (url, expected_key, expected_val) in cases {
        let payload = make_payload(url, headers.clone(), None);
        let (req, res) = run_chain(&payload);
        if res.http_status == HttpStatusCode::OK {
            let q = req.query_params.unwrap();
            assert_eq!(q.get(expected_key).unwrap(), expected_val);
        } else {
            assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        }
    }
}

#[test]
fn semicolon_as_delimiter_handling() {
    let headers = HashMap::new();
    let url = "http://a.com/a?a=1;b=2";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    // Some parsers accept ';' as a delimiter; we accept either behavior
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        // If ';' not treated as delimiter, the whole segment might be the key
        if let Some(v) = q.get("a") {
            assert_eq!(v, "1");
        }
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn depth_overflow_is_rejected() {
    let headers = HashMap::new();
    // Build a query with nesting depth 33 to exceed default 32
    let mut key = String::from("a");
    for _ in 0..33 { key.push_str("["); key.push_str("x"); key.push_str("]"); }
    let url = format!("http://a.com/a?{}=1", key);
    let payload = make_payload(&url, headers, None);
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::BadRequest);
}

#[test]
fn empty_array_elements_and_flags() {
    let headers = HashMap::new();
    // a[] without value and with empty value
    let url = "http://a.com/a?a[]&a[]=";
    let payload = make_payload(url, headers, None);
    let (req, res) = run_chain(&payload);
    if res.http_status == HttpStatusCode::OK {
        let q = req.query_params.unwrap();
        let a = q.get("a").unwrap();
        let arr = a.as_array().unwrap();
        // Accept either ["", ""] or coalesced empty entries
        assert!(arr.len() >= 1);
    } else {
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
    }
}
 */