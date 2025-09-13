use crate::ffi::common::*;
use bunner_http_server::*;
use bunner_http_server::structure::HandleRequestOutput;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Barrier};
use crossbeam_channel as mpsc;

#[test]
fn handles_concurrent_requests_correctly() {
    let handle = init();
    let (tx, rx) = mpsc::unbounded::<String>();

    unsafe {
        add_route(handle, 0, to_cstr("/users/:id").as_ptr());
        seal_routes(handle);
    }

    let num_threads = 16;
    let num_reqs_per_thread = 100;
    let barrier = Arc::new(Barrier::new(num_threads));
    let handle_addr = handle as usize;

    for i in 0..num_threads {
        let tx_clone = tx.clone();
        let barrier_clone = barrier.clone();
        std::thread::spawn(move || {
            barrier_clone.wait();
            for j in 0..num_reqs_per_thread {
                let user_id = i * num_reqs_per_thread + j;
                let payload = json!({
                    "httpMethod": 0,
                    "url": format!("http://localhost/users/{}", user_id),
                    "headers": {},
                    "body": null
                })
                .to_string();

                unsafe {
                    let handle = handle_addr as *mut HttpServer;
                    let req_id = make_req_id(&tx_clone);
                    handle_request(handle, to_cstr(&req_id).as_ptr(), to_cstr(&payload).as_ptr(), test_callback);
                }
            }
        });
    }

    let mut results: HashMap<String, usize> = HashMap::new();
    for _ in 0..(num_threads * num_reqs_per_thread) {
        let res_str = rx.recv().unwrap();
        let out: HandleRequestOutput = serde_json::from_str(&res_str).unwrap();
        let res = out.request;
        let id = res.params.unwrap()["id"].as_str().unwrap().to_string();
        *results.entry(id).or_insert(0) += 1;
    }

    assert_eq!(
        results.len(),
        num_threads * num_reqs_per_thread,
        "Should receive a result for every request"
    );
    for count in results.values() {
        assert_eq!(*count, 1, "Each request ID should be unique");
    }

    unsafe { destroy(handle) };
}
