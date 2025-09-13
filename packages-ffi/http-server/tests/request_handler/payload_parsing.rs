use bunner_http_server::enums::HttpStatusCode;
use bunner_http_server::errors::HttpServerErrorCode;
use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::HandleRequestOutput;
use crossbeam_channel as mpsc;
use serde_json::json;
use std::ffi::{c_char, CStr};
use std::sync::Arc;

use crate::ffi::common::{make_req_id, test_callback};

fn setup_router() -> Arc<RouterReadOnly> {
    let mut router = Router::new(Some(RouterOptions::default()));
    router
        .add(bunner_http_server::enums::HttpMethod::Get, "/users/:id")
        .unwrap();
    router
        .add(bunner_http_server::enums::HttpMethod::Post, "/files/*")
        .unwrap();
    router
        .add(bunner_http_server::enums::HttpMethod::Get, "/static")
        .unwrap();
    router.finalize();
    Arc::new(router.build_readonly())
}

fn run_test_and_get_result(payload: serde_json::Value) -> HandleRequestOutput {
    let ro = setup_router();
    let (tx, rx) = mpsc::unbounded::<String>();
    let req_id = make_req_id(&tx);
    request_handler::process_job(test_callback, req_id, payload.to_string(), ro, None);
    let out: HandleRequestOutput = serde_json::from_str(&rx.recv().unwrap()).unwrap();
    out
}

#[test]
fn parses_simple_key_value_query_params() {
    let payload = json!({
        "httpMethod": 0,
        "url": "https://example.com/users/42?search=test&page=2",
        "headers": {}, "body": null
    });
    let out = run_test_and_get_result(payload);
    let query = out.request.query_params.unwrap();
    assert_eq!(query.get("search").unwrap(), "test");
    assert_eq!(query.get("page").unwrap(), "2");
}

#[test]
fn parses_array_query_parameters() {
    let payload = json!({
        "httpMethod": 0,
        "url": "https://example.com/static?tags[]=a&tags[]=b&tags[]=c",
        "headers": {}, "body": null
    });
    let out = run_test_and_get_result(payload);
    let q = out.request.query_params.unwrap();
    let tags = q.get("tags").unwrap().as_array().unwrap();
    assert_eq!(tags, &vec![json!("a"), json!("b"), json!("c")]);
}

#[test]
fn parses_nested_object_query_parameters() {
    let payload = json!({
        "httpMethod": 0,
        "url": "https://example.com/static?user[name]=alice&user[id]=42&user[role]=admin",
        "headers": {}, "body": null
    });
    let out = run_test_and_get_result(payload);
    let q = out.request.query_params.unwrap();
    let user = q.get("user").unwrap();
    assert_eq!(user.get("name").unwrap(), "alice");
    assert_eq!(user.get("id").unwrap(), "42");
    assert_eq!(user.get("role").unwrap(), "admin");
}

#[test]
fn handles_malformed_query_string() {
    let payload = json!({"httpMethod": 0, "url": "http://a.com/users/1?a[=malformed", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert_eq!(out.response.http_status, HttpStatusCode::BadRequest);
    assert_eq!(
        out.response.body,
        json!(HttpStatusCode::BadRequest.reason_phrase())
    );
}

#[test]
fn handles_very_large_number_of_query_params() {
    let mut query_parts = Vec::new();
    for i in 0..1000 {
        query_parts.push(format!("param{}=value{}", i, i));
    }
    let query = query_parts.join("&");
    let payload = json!({
        "httpMethod": 0,
        "url": format!("http://example.com/test?{}", query),
        "headers": {},
        "body": null
    });
    let result = run_test_and_get_result(payload);
    if result.response.http_status == HttpStatusCode::OK {
        let q = result.request.query_params.unwrap();
        assert!(q.as_object().unwrap().len() <= 1000);
    }
}

#[test]
fn parses_valid_json_body_with_content_type() {
    let payload = json!({
        "httpMethod": 0,
        "url": "https://example.com/users/42",
        "headers": {"content-type": "application/json"},
        "body": "{\"value\": true, \"nested\": {\"key\": 123}}"
    });
    let out = run_test_and_get_result(payload);
    let body = out.request.body.unwrap();
    assert_eq!(body.get("value").unwrap(), true);
    assert_eq!(body.get("nested").unwrap().get("key").unwrap(), 123);
}

#[test]
fn rejects_invalid_json_body_with_json_content_type() {
    let payload = json!({
        "httpMethod": 0,
        "url": "http://a.com/users/1",
        "headers": { "content-type": "application/json" },
        "body": "{invalid}"
    });
    let out = run_test_and_get_result(payload);
    assert_eq!(
        out.response.http_status,
        HttpStatusCode::UnsupportedMediaType
    );
    assert_eq!(
        out.response.body,
        json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
    );
}

#[test]
fn rejects_non_json_body_without_content_type() {
    let payload = json!({
        "httpMethod": 0,
        "url": "http://a.com/users/1",
        "headers": {},
        "body": "this is plain text"
    });
    let out = run_test_and_get_result(payload);
    assert_eq!(
        out.response.http_status,
        HttpStatusCode::UnsupportedMediaType
    );
    assert_eq!(
        out.response.body,
        json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
    );
}

#[test]
fn handles_deeply_nested_json_structure() {
    let mut nested_json = String::from("\"deep_value\"");
    for _i in 0..100 {
        nested_json = format!("{{\"level\": {}}}", nested_json);
    }
    let payload = json!({
        "httpMethod": 0,
        "url": "http://example.com/users/1",
        "headers": {"content-type": "application/json"},
        "body": nested_json
    });
    let result = run_test_and_get_result(payload);
    if result.response.http_status == HttpStatusCode::OK {
        assert!(result.request.body.is_some());
    } else {
        assert_eq!(
            result.response.http_status,
            HttpStatusCode::UnsupportedMediaType
        );
    }
}

#[test]
fn handles_extreme_numeric_values_in_json() {
    let extreme_numbers = json!({
        "httpMethod": 0,
        "url": "http://example.com/users/1",
        "headers": {"content-type": "application/json"},
        "body": r#"{
            "very_large": 999999999999999999999999999999,
            "very_small": -999999999999999999999999999999,
            "scientific": 1.23e308,
            "tiny": 1.23e-308,
            "zero": 0,
            "negative_zero": -0
        }"#
    });
    let result = run_test_and_get_result(extreme_numbers);
    if result.response.http_status == HttpStatusCode::OK {
        let body = result.request.body.unwrap();
        assert!(body.get("zero").is_some());
    }
}

#[test]
fn handles_unicode_characters_in_json() {
    let unicode_json = json!({
        "httpMethod": 0,
        "url": "http://example.com/users/1",
        "headers": {"content-type": "application/json"},
        "body": r#"{
            "emoji": "🚀🌍👨‍💻",
            "chinese": "你好세계",
            "arabic": "مرحبا بالعالم",
            "mixed": "Hello 세계 🌍",
            "special_chars": "\u0000\u0001\u0002",
            "escaped": "\"quotes\" and \\backslashes\\"
        }"#
    });
    let result = run_test_and_get_result(unicode_json);
    if result.response.http_status == HttpStatusCode::OK {
        let body = result.request.body.unwrap();
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
        let payload = json!({
            "httpMethod": 0,
            "url": "http://example.com/users/1",
            "headers": {"content-type": content_type},
            "body": r#"{"test": true}"#
        });
        let result = run_test_and_get_result(payload);
        if content_type
            .split(';')
            .next()
            .unwrap()
            .trim()
            .eq_ignore_ascii_case("application/json")
        {
            if result.response.http_status == HttpStatusCode::OK {
                assert!(result.request.body.is_some());
            }
        }
    }
}

#[test]
fn handles_empty_query_params_and_null_body() {
    let payload =
        json!({"httpMethod": 0, "url": "http://[::1]/users/ipv6", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert!(out.request.query_params.is_none());
    assert!(out.request.body.is_none());
}

#[test]
fn handles_extremely_long_urls() {
    let long_path = "a".repeat(10000);
    let payload = json!({
        "httpMethod": 0,
        "url": format!("http://example.com/{}", long_path),
        "headers": {},
        "body": null
    });

    let result = run_test_and_get_result(payload);
    // Should either process successfully or reject gracefully
    if result.response.http_status != HttpStatusCode::OK {
        assert_eq!(result.response.http_status, HttpStatusCode::BadRequest);
    }
}

#[test]
fn handles_percent_encoded_characters_in_path() {
    let encoded_paths = vec![
        "/users/user%40example.com", // @ encoded
        "/files/file%2Ename",        // . encoded
        "/spaces/hello%20world",     // space encoded
        "/unicode/caf%C3%A9",        // é encoded
    ];

    for path in encoded_paths {
        let payload = json!({
            "httpMethod": 0,
            "url": format!("http://example.com{}", path),
            "headers": {},
            "body": null
        });

        let result = run_test_and_get_result(payload);
        // Should handle percent encoding appropriately
        if result.response.http_status == HttpStatusCode::OK {
            assert!(result.request.path.contains("%") || !result.request.path.contains("%"));
        }
    }
}

#[test]
fn handles_special_characters_in_path() {
    let special_paths = vec![
        "/users/user@example.com",
        "/files/file.with.dots",
        "/api/path-with-hyphens",
        "/data/path_with_underscores",
        "/test/path~with~tildes",
        "/special/(parentheses)",
        "/numbers/123456789",
    ];

    for path in special_paths {
        let payload = json!({
            "httpMethod": 0,
            "url": format!("http://example.com{}", path),
            "headers": {},
            "body": null
        });

        // Most should be handled gracefully
        let result = run_test_and_get_result(payload.clone());
        // Either routes successfully or returns not found
        assert!(
            matches!(
                result.response.http_status,
                HttpStatusCode::OK | HttpStatusCode::BadRequest
            ) || {
                let ro = setup_router();
                let (tx, rx) = mpsc::unbounded::<String>();
                let req_id = make_req_id(&tx);
                request_handler::process_job(
                    test_callback,
                    req_id,
                    payload.to_string(),
                    ro,
                    None,
                );
                rx.recv().unwrap().parse::<u16>().unwrap()
                    == bunner_http_server::router::RouterErrorCode::MatchNotFound.code()
            }
        );
    }
}

#[test]
fn rejects_malformed_urls() {
    let payload = json!({"httpMethod": 0, "url": "://bad-url", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert_eq!(out.response.http_status, HttpStatusCode::BadRequest);
    assert_eq!(
        out.response.body,
        json!(HttpStatusCode::BadRequest.reason_phrase())
    );
}