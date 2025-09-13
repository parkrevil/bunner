use bunner_http_server::errors::HttpServerErrorCode;
use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
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
fn rejects_invalid_json_payload_structure() {
    // This test needs to construct an invalid string manually, as json!() macro creates valid json
    let ro = setup_router();
    let (tx, rx) = mpsc::unbounded::<String>();
    let req_id = make_req_id(&tx);
    let payload_str = "{ \"httpMethod\": 0, ".to_string(); // Incomplete JSON

    request_handler::process_job(test_callback, req_id, payload_str, ro, None);

    let res: serde_json::Value = serde_json::from_str(&rx.recv().unwrap()).unwrap();
    let code = res.get("code").unwrap().as_u64().unwrap() as u16;
    assert_eq!(code, HttpServerErrorCode::InvalidJsonString.code());
}

#[test]
fn rejects_payload_missing_required_fields() {
    let payload = json!({"httpMethod": 0, "headers": {}, "body": null}); // Missing "url"
    let code = run_test_and_get_error_code(payload);
    assert_eq!(code, HttpServerErrorCode::InvalidJsonString.code());
}