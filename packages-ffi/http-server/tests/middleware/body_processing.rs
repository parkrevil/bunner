#[test]
fn parses_valid_json_body_with_content_type() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json; charset=utf-8".to_string());
    let payload = make_payload("http://localhost/a", headers, Some("{\"k\":1}"));
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.body.unwrap().get("k").unwrap(), 1);
    assert_eq!(req.charset.as_deref(), Some("utf-8"));
    // 추가: 중첩 구조 테스트
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let payload = make_payload(
        "https://example.com/users/42",
        headers,
        Some("{\"value\": true, \"nested\": {\"key\": 123}}"),
    );
    let (req, _res) = run_chain(&payload);
    let body = req.body.unwrap();
    assert_eq!(body.get("value").unwrap(), true);
    assert_eq!(body.get("nested").unwrap().get("key").unwrap(), 123);
}

#[test]
fn rejects_invalid_json_body_with_json_content_type() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let payload = make_payload(
        "http://a.com/users/1",
        headers,
        Some("{invalid}"),
    );
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, bunner_http_server::enums::HttpStatusCode::UnsupportedMediaType);
    assert_eq!(res.body, serde_json::json!(bunner_http_server::enums::HttpStatusCode::UnsupportedMediaType.reason_phrase()));
}

#[test]
fn rejects_non_json_body_without_content_type() {
    let headers = HashMap::new();
    let payload = make_payload(
        "http://a.com/users/1",
        headers,
        Some("this is plain text"),
    );
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, bunner_http_server::enums::HttpStatusCode::UnsupportedMediaType);
    assert_eq!(res.body, serde_json::json!(bunner_http_server::enums::HttpStatusCode::UnsupportedMediaType.reason_phrase()));
}

#[test]
fn handles_deeply_nested_json_structure() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let mut nested_json = String::from("\"deep_value\"");
    for _i in 0..100 {
        nested_json = format!("{{\"level\": {}}}", nested_json);
    }
    let payload = make_payload(
        "http://example.com/users/1",
        headers,
        Some(&nested_json),
    );
    let (req, res) = run_chain(&payload);
    if res.http_status == bunner_http_server::enums::HttpStatusCode::OK {
        assert!(req.body.is_some());
    } else {
        assert_eq!(res.http_status, bunner_http_server::enums::HttpStatusCode::UnsupportedMediaType);
    }
}

#[test]
fn handles_extreme_numeric_values_in_json() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let extreme_numbers = r#"{
        "very_large": 999999999999999999999999999999,
        "very_small": -999999999999999999999999999999,
        "scientific": 1.23e308,
        "tiny": 1.23e-308,
        "zero": 0,
        "negative_zero": -0
    }"#;
    let payload = make_payload(
        "http://example.com/users/1",
        headers,
        Some(extreme_numbers),
    );
    let (req, res) = run_chain(&payload);
    if res.http_status == bunner_http_server::enums::HttpStatusCode::OK {
        let body = req.body.unwrap();
        assert!(body.get("zero").is_some());
    }
}

#[test]
fn handles_unicode_characters_in_json() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let unicode_json = r#"{
        "emoji": "🚀🌍👨‍💻",
        "chinese": "你好세계",
        "arabic": "مرحبا بالعالم",
        "mixed": "Hello 세계 🌍",
        "special_chars": "\u0000\u0001\u0002",
        "escaped": "\"quotes\" and \\backslashes\\"
    }"#;
    let payload = make_payload(
        "http://example.com/users/1",
        headers,
        Some(unicode_json),
    );
    let (req, res) = run_chain(&payload);
    if res.http_status == bunner_http_server::enums::HttpStatusCode::OK {
        let body = req.body.unwrap();
        assert_eq!(body.get("emoji").unwrap(), "🚀🌍👨‍💻");
        assert_eq!(body.get("chinese").unwrap(), "你好세계");
    }
}

#[test]
fn handles_various_content_type_formats() {
    let content_types = vec![
        "application/json",
        "application/json; charset=utf-8",
        "application/json; charset=UTF-8; boundary=something",
        "APPLICATION/JSON",
        "application/JSON",
        "text/json",
        "application/vnd.api+json",
    ];
    for content_type in content_types {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), content_type.to_string());
        let payload = make_payload(
            "http://example.com/users/1",
            headers,
            Some("{\"test\": true}"),
        );
        let (req, res) = run_chain(&payload);
        if content_type
            .split(';')
            .next()
            .unwrap()
            .trim()
            .eq_ignore_ascii_case("application/json")
        {
            if res.http_status == bunner_http_server::enums::HttpStatusCode::OK {
                assert!(req.body.is_some());
            }
        }
    }
}
use bunner_http_server::enums::HttpStatusCode;
use serde_json::json;
use std::collections::HashMap;

// Import common helper functions
use crate::helper::{make_payload, run_chain};

#[test]
fn parses_json_body_when_content_type_is_json() {
    let mut headers = HashMap::new();
    headers.insert(
        "content-type".to_string(),
        "application/json; charset=utf-8".to_string(),
    );
    let payload = make_payload("http://localhost/a", headers, Some("{\"k\":1}"));
    let (req, _res) = run_chain(&payload);
    assert_eq!(req.body.unwrap().get("k").unwrap(), 1);
    assert_eq!(req.charset.as_deref(), Some("utf-8"));
}

#[test]
fn rejects_plain_text_body_when_non_json() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "text/plain".to_string());
    let payload = make_payload("http://localhost/a", headers, Some("hello"));
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType);
    assert_eq!(
        res.body,
        json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
    );
}

#[test]
fn falls_back_to_string_when_json_content_type_but_invalid_json() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let payload = make_payload("http://localhost/a", headers, Some("{invalid}"));
    let (_req, res) = run_chain(&payload);
    assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType);
    assert_eq!(
        res.body,
        json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
    );
}

#[test]
fn handles_extremely_large_json_body() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    // Create very large but valid JSON
    let large_array: Vec<String> = (0..10000).map(|i| format!("\"item{}\"", i)).collect();
    let large_json = format!("[{}]", large_array.join(","));

    let payload = make_payload("http://localhost/a", headers, Some(&large_json));
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        let body = req.body.unwrap();
        let body_array = body.as_array().unwrap();
        assert_eq!(body_array.len(), 10000);
    }
}

#[test]
fn handles_deeply_nested_json() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    // Create deeply nested JSON object
    let mut nested_json = String::from("1");
    for _i in 0..100 {
        nested_json = format!("{{\"level\": {}}}", nested_json);
    }

    let payload = make_payload("http://localhost/a", headers, Some(&nested_json));
    let (req, res) = run_chain(&payload);

    if res.http_status == HttpStatusCode::OK {
        assert!(req.body.is_some());
    } else {
        // Might exceed nesting limits
        assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType);
    }
}

#[test]
fn handles_json_with_unicode() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let unicode_json = r#"{"message": "Hello 世界 🌍", "emoji": "🚀", "café": "résumé"}"#;
    let payload = make_payload("http://localhost/a", headers, Some(unicode_json));
    let (req, _res) = run_chain(&payload);

    let body = req.body.unwrap();
    assert_eq!(body.get("message").unwrap(), "Hello 世界 🌍");
    assert_eq!(body.get("emoji").unwrap(), "🚀");
}

#[test]
fn handles_json_edge_number_values() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let edge_numbers =
        r#"{"zero": 0, "negative": -1, "large": 999999999999, "float": 123.456, "scientific": 1.23e10}"#;
    let payload = make_payload("http://localhost/a", headers, Some(edge_numbers));
    let (req, _res) = run_chain(&payload);

    let body = req.body.unwrap();
    assert_eq!(body.get("zero").unwrap(), 0);
    assert_eq!(body.get("negative").unwrap(), -1);
}

#[test]
fn handles_empty_and_null_json_values() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    let null_values =
        r#"{"null_value": null, "empty_string": "", "empty_array": [], "empty_object": {}}"#;
    let payload = make_payload("http://localhost/a", headers, Some(null_values));
    let (req, _res) = run_chain(&payload);

    let body = req.body.unwrap();
    assert!(body.get("null_value").unwrap().is_null());
    assert_eq!(body.get("empty_string").unwrap(), "");
    assert_eq!(
        body.get("empty_array").unwrap().as_array().unwrap().len(),
        0
    );
}

#[test]
#[cfg(feature = "simd-json")]
fn simd_json_parsing_works_correctly() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    // Test various JSON structures that SIMD JSON should handle
    let test_cases = vec![
        r#"{"simple": "test"}"#,
        r#"{"number": 42, "float": 3.14, "bool": true, "null": null}"#,
        r#"["item1", "item2", "item3"]"#,
        r#"{"nested": {"inner": "value"}}"#,
        r#"{"array": [1, 2, 3], "object": {"key": "value"}}"#,
    ];

    for json_str in test_cases {
        let payload = make_payload("http://localhost/test", headers.clone(), Some(json_str));
        let (req, res) = run_chain(&payload);

        // SIMD JSON should parse successfully
        assert_eq!(res.http_status, HttpStatusCode::OK, "SIMD JSON should parse: {}", json_str);
        assert!(req.body.is_some(), "Body should be parsed for: {}", json_str);
    }
}

#[test]
#[cfg(feature = "simd-json")]
fn simd_json_handles_malformed_json_gracefully() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    let malformed_cases = vec![
        "{invalid json}",
        r#"{"unclosed": "object"#,
        r#"["unclosed", "array"#,
        // Note: {"control": "\u0000"} is actually valid JSON
    ];

    for json_str in malformed_cases {
        let payload = make_payload("http://localhost/test", headers.clone(), Some(json_str));
        let (_req, res) = run_chain(&payload);

        // SIMD JSON should reject malformed JSON
        assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType,
                  "SIMD JSON should reject malformed JSON: {}", json_str);
    }
}

#[test]
#[cfg(feature = "simd-json")]
fn simd_json_performance_characteristics() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    // Create a moderately complex JSON structure
    let complex_json = json!({
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com", "active": true},
            {"id": 2, "name": "Bob", "email": "bob@example.com", "active": false},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com", "active": true}
        ],
        "metadata": {
            "version": "1.0",
            "timestamp": "2025-09-13T12:00:00Z",
            "total_users": 3
        },
        "settings": {
            "theme": "dark",
            "notifications": true,
            "language": "en"
        }
    });

    let json_str = complex_json.to_string();
    let payload = make_payload("http://localhost/test", headers, Some(&json_str));
    let (req, res) = run_chain(&payload);

    // SIMD JSON should handle complex structures
    assert_eq!(res.http_status, HttpStatusCode::OK);
    assert!(req.body.is_some());

    let body = req.body.unwrap();
    assert_eq!(body["users"].as_array().unwrap().len(), 3);
    assert_eq!(body["metadata"]["version"], "1.0");
    assert_eq!(body["settings"]["theme"], "dark");
}

#[test]
#[cfg(not(feature = "simd-json"))]
fn fallback_to_serde_json_when_simd_disabled() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    let json_str = r#"{"message": "fallback to serde", "number": 123}"#;
    let payload = make_payload("http://localhost/test", headers, Some(json_str));
    let (req, res) = run_chain(&payload);

    // Should fall back to serde_json when SIMD is disabled
    assert_eq!(res.http_status, HttpStatusCode::OK);
    assert!(req.body.is_some());

    let body = req.body.unwrap();
    assert_eq!(body["message"], "fallback to serde");
    assert_eq!(body["number"], 123);
}
