use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterErrorCode, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::HandleRequestOutput;
use crossbeam_channel as mpsc;
use serde_json::json;
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

fn run_test_and_get_error_code(payload: serde_json::Value) -> u16 {
    let ro = setup_router();
    let (tx, rx) = mpsc::unbounded::<String>();
    let req_id = make_req_id(&tx);
    request_handler::process_job(test_callback, req_id, payload.to_string(), ro, None);
    let msg = rx.recv().unwrap();
    let res: serde_json::Value = serde_json::from_str(&msg).unwrap();
    res.get("code").and_then(|v| v.as_u64()).unwrap() as u16
}

#[test]
fn matches_static_routes_without_parameters() {
    let payload =
        json!({"httpMethod": 0, "url": "http://localhost/static", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert!(out.request.params.is_none());
}

#[test]
fn matches_parameterized_routes_and_extracts_values() {
    let payload =
        json!({"httpMethod": 0, "url": "https://example.com/users/12345", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert_eq!(out.request.params.unwrap().get("id").unwrap(), "12345");
}

#[test]
fn matches_wildcard_routes_and_extracts_remaining_path() {
    let payload = json!({"httpMethod": 1, "url": "http://test.com/files/path/to/my/file.txt", "headers": {}, "body": null});
    let out = run_test_and_get_result(payload);
    assert_eq!(
        out.request.params.unwrap().get("*").unwrap(),
        "path/to/my/file.txt"
    );
}

#[test]
fn returns_not_found_error_for_unmatched_routes() {
    let payload =
        json!({"httpMethod": 0, "url": "http://a.com/this/route/does/not/exist", "headers": {}, "body": null});
    let code = run_test_and_get_error_code(payload);
    assert_eq!(code, RouterErrorCode::MatchNotFound.code());
}