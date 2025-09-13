use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::HandleRequestOutput;
use serde_json::json;
use std::ffi::{c_char, CStr};
use std::sync::Arc;
use crossbeam_channel as mpsc;

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
fn parses_multiple_cookies_from_header() {
    let payload = json!({
        "httpMethod": 0, "url": "http://a.com/users/1",
        "headers": { "cookie": "a=1; b=2; c=3" }, "body": null
    });
    let out = run_test_and_get_result(payload);
    let cookies = out.request.cookies;
    assert_eq!(cookies.get("a").unwrap(), "1");
    assert_eq!(cookies.get("b").unwrap(), "2");
    assert_eq!(cookies.get("c").unwrap(), "3");
}

#[test]
fn extracts_content_type_and_charset() {
    let payload = json!({
        "httpMethod": 0, "url": "http://a.com/users/1",
        "headers": { "content-type": "application/json; charset=utf-8" }, "body": null
    });
    let out = run_test_and_get_result(payload);
    assert_eq!(out.request.content_type.unwrap(), "application/json");
    assert_eq!(out.request.charset.unwrap(), "utf-8");
}

#[test]
fn excludes_raw_headers_from_serialized_output() {
    let payload = json!({
        "httpMethod": 0, "url": "http://a.com/users/1",
        "headers": { "x-custom": "v1", "content-type": "text/plain" }, "body": null
    });
    let raw = run_test_and_get_result(payload);
    let serialized = serde_json::to_value(&raw.request).unwrap();

    assert!(serialized.get("headers").is_none());
}

#[test]
fn handles_headers_with_special_characters() {
    let payload = json!({
        "httpMethod": 0,
        "url": "http://example.com/users/1",
        "headers": {
            "x-special-chars": "!@#$%^&*()_+-=[]{}|;':\",./<>?",
            "x-unicode": "café résumé 测试",
            "x-empty": "",
            "x-very-long": "x".repeat(5000)
        },
        "body": null
    });

    let result = run_test_and_get_result(payload);
    assert_eq!(
        result.response.http_status,
        bunner_http_server::enums::HttpStatusCode::OK
    );

    // Headers should be preserved as-is
    assert!(result.request.headers.contains_key("x-special-chars"));
    assert!(result.request.headers.contains_key("x-unicode"));
    assert!(result.request.headers.contains_key("x-empty"));
}

#[test]
fn handles_large_number_of_headers() {
    let mut headers = serde_json::Map::new();
    for i in 0..500 {
        headers.insert(format!("x-header-{}", i), json!(format!("value-{}", i)));
    }

    let payload = json!({
        "httpMethod": 0,
        "url": "http://example.com/users/1",
        "headers": headers,
        "body": null
    });

    let result = run_test_and_get_result(payload);
    assert_eq!(
        result.response.http_status,
        bunner_http_server::enums::HttpStatusCode::OK
    );
    assert!(result.request.headers.len() <= 500);
}
