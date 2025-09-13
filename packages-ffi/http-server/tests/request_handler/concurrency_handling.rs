use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use serde_json::json;
use std::sync::{Arc, Barrier};
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

#[test]
fn processes_concurrent_requests_with_varying_payload_sizes() {
    let ro = setup_router();
    let barrier = Arc::new(Barrier::new(5));

    let handles: Vec<_> = (0..5)
        .map(|i| {
            let ro_clone = ro.clone();
            let barrier_clone = barrier.clone();

            std::thread::spawn(move || {
                barrier_clone.wait();

                let (tx, rx) = mpsc::unbounded::<String>();
                let req_id = make_req_id(&tx);

                // Vary payload size
                let body_size = i * 500; // 0 to 2000 chars
                let large_body = "x".repeat(body_size);

                let payload = json!({
                    "httpMethod": 0,
                    "url": format!("http://example.com/users/{}", i),
                    "headers": {},
                    "body": large_body
                });

                request_handler::process_job(
                    test_callback,
                    req_id,
                    payload.to_string(),
                    ro_clone,
                    None,
                );

                rx.recv().is_ok()
            })
        })
        .collect();

    let mut successes = 0;
    for handle in handles {
        if handle.join().unwrap() {
            successes += 1;
        }
    }

    assert!(successes > 0, "At least some requests should succeed");
}

#[test]
fn handles_concurrent_malformed_requests_gracefully() {
    let ro = setup_router();
    let barrier = Arc::new(Barrier::new(4));

    let malformed_payloads = vec![
        r#"{"httpMethod": 0}"#,       // Missing fields
        r#"{"httpMethod": "invalid"}"#, // Wrong type
        r#"invalid json"#,             // Not JSON
        r#"{incomplete"#,             // Incomplete
    ];

    let handles: Vec<_> = malformed_payloads
        .into_iter()
    .enumerate()
    .map(|(_i, payload)| {
            let ro_clone = ro.clone();
            let barrier_clone = barrier.clone();
            let payload_owned = payload.to_string();

            std::thread::spawn(move || {
                barrier_clone.wait();

                let (tx, rx) = mpsc::unbounded::<String>();
                let req_id = make_req_id(&tx);

                request_handler::process_job(
                    test_callback,
                    req_id,
                    payload_owned,
                    ro_clone,
                    None,
                );

                // Should get an error response
                rx.recv().is_ok()
            })
        })
        .collect();

    // All should complete (with error responses)
    for handle in handles {
        assert!(handle.join().unwrap(), "Should receive error response");
    }
}
