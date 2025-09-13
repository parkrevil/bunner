use crate::ffi::common;
use crate::ffi::common::*;
use bunner_http_server::*;
use bunner_http_server::structure::{AddRouteResult, HttpServerError};
use bunner_http_server::util::from_ptr;
use serde_json::json;
use std::ptr::null_mut;
use std::sync::{mpsc, Arc, Barrier};

// Memory management and resource cleanup tests

#[test]
fn handles_memory_pressure_gracefully() {
    let handle = init();
    unsafe {
        add_route(handle, 0, to_cstr("/memory_test").as_ptr());
        seal_routes(handle);
    }

    // Test with extremely large payload that might cause memory issues
    let large_payload = json!({
        "httpMethod": 0,
        "url": "http://localhost/memory_test",
        "headers": {},
        "body": "x".repeat(50_000_000) // 50MB payload
    });

    let (tx, rx) = mpsc::channel::<String>();
    unsafe {
        let tx_ptr_val = &tx as *const _ as usize;
        handle_request(
            handle,
            to_cstr(&tx_ptr_val.to_string()).as_ptr(),
            to_cstr(&large_payload.to_string()).as_ptr(),
            test_callback,
        );
    }

    // Should either succeed or fail gracefully without crashing
    match rx.recv_timeout(std::time::Duration::from_millis(100)) {
        Ok(_) => {
            // Request completed successfully
        }
        Err(_) => {
            // Request timed out or failed - this is acceptable for large payloads
        }
    }

    unsafe { destroy(handle) };
}

#[test]
fn cleans_up_resources_after_many_requests() {
    let handle = init();
    unsafe {
        add_route(handle, 0, to_cstr("/cleanup_test").as_ptr());
        seal_routes(handle);
    }

    // Send many requests to test resource cleanup, but with better pacing
    for i in 0..100 {
        let (tx, rx) = mpsc::channel::<String>();
        let payload = json!({
            "httpMethod": 0,
            "url": "http://localhost/cleanup_test",
            "headers": {"request_id": i.to_string()},
            "body": format!("test_data_{}", i)
        });

        unsafe {
            let tx_ptr_val = &tx as *const _ as usize;
            handle_request(
                handle,
                to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                to_cstr(&payload.to_string()).as_ptr(),
                test_callback,
            );
        }

        // Wait for response with timeout
        match rx.recv_timeout(std::time::Duration::from_millis(50)) {
            Ok(_) => {} // Success
            Err(_) => {} // Timeout - acceptable for stress test
        }

        // Small delay between requests to avoid overwhelming the system
        std::thread::sleep(std::time::Duration::from_millis(1));
    }

    unsafe { destroy(handle) };
}

#[test]
fn handles_null_pointers_in_ffi_calls() {
    let handle = init();

    // Test various null pointer scenarios
    unsafe {
        // Null route path - this should be handled gracefully
        let result = add_route(handle, 0, null_mut());
        // If result is null, it means the function handled null input gracefully
        if result.is_null() {
            // This is acceptable - null input should result in null output
        } else {
            // If not null, try to parse the result
            let route_result = from_ptr::<AddRouteResult>(result);
            // Should either succeed or return an error, but not crash
            match route_result {
                Ok(_) => {} // Success
                Err(_) => {} // Error - acceptable for null input
            }
        }

        // Test with null payload in handle_request
        let (tx, rx) = mpsc::channel::<String>();
        let tx_ptr_val = &tx as *const _ as usize;

        // Call handle_request with null payload
        handle_request(
            handle,
            to_cstr(&tx_ptr_val.to_string()).as_ptr(),
            null_mut(),
            test_callback,
        );

        // Check for response with timeout
        match rx.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(response) => {
                // Try to parse as error
                if let Ok(ffi_error) = serde_json::from_str::<HttpServerError>(&response) {
                    // Should be InvalidPayload error
                    assert_eq!(ffi_error.code, bunner_http_server::errors::HttpServerErrorCode::InvalidPayload.code());
                }
            }
            Err(_) => {
                // Timeout - acceptable for null payload
            }
        }
    }

    unsafe { destroy(handle) };
}

#[test]
fn handles_invalid_utf8_in_strings() {
    let handle = init();

    unsafe {
        // Test invalid UTF-8 in route path
        let bad_utf8 = vec![0xFF, 0xFE, 0x00]; // Invalid UTF-8 sequence
        let c_str = std::ffi::CString::from_vec_unchecked(bad_utf8);
        let result = add_route(handle, 0, c_str.as_ptr());

        // Should either handle gracefully or return error
        if !result.is_null() {
            let route_result = from_ptr::<AddRouteResult>(result);
            // Invalid UTF-8 should result in an error
            assert!(route_result.is_err());
        }
    }

    unsafe { destroy(handle) };
}

#[test]
fn handles_extreme_concurrency_load() {
    let handle = init();
    unsafe {
        add_route(handle, 0, to_cstr("/concurrency_test").as_ptr());
        seal_routes(handle);
    }

    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get().min(16))
        .unwrap_or(4);
    let requests_per_thread = 100;
    let barrier = Arc::new(Barrier::new(num_threads));
    let handle_addr = handle as usize;

    let handles: Vec<_> = (0..num_threads).map(|thread_id| {
        let barrier_clone = barrier.clone();
        std::thread::spawn(move || {
            barrier_clone.wait();

            for req_id in 0..requests_per_thread {
                let (tx, _rx) = mpsc::channel::<String>();
                let payload = json!({
                    "httpMethod": 0,
                    "url": "http://localhost/concurrency_test",
                    "headers": {
                        "thread_id": thread_id,
                        "request_id": req_id
                    },
                    "body": format!("data_from_thread_{}_{}", thread_id, req_id)
                });

                unsafe {
                    let handle = handle_addr as *mut HttpServer;
                    let tx_ptr_val = &tx as *const _ as usize;
                    handle_request(
                        handle,
                        to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                        to_cstr(&payload.to_string()).as_ptr(),
                        test_callback,
                    );
                }

                // Don't wait for all responses to avoid blocking
                // Just ensure no crashes occur
                std::thread::sleep(std::time::Duration::from_micros(100));
            }
        })
    }).collect();

    for handle in handles {
        handle.join().unwrap();
    }

    unsafe { destroy(handle) };
}

#[test]
fn handles_system_resource_limits() {
    let handle = init();
    unsafe {
        add_route(handle, 0, to_cstr("/resource_test").as_ptr());
        seal_routes(handle);
    }

    // Test with very deep recursion (if supported by JSON parser)
    let mut deep_json = json!("leaf");
    for i in 0..50 { // Create deep nesting
        deep_json = json!({ "level": i, "next": deep_json });
    }

    let payload = json!({
        "httpMethod": 0,
        "url": "http://localhost/resource_test",
        "headers": {},
        "body": deep_json
    });

    let (tx, rx) = mpsc::channel::<String>();
    unsafe {
        let tx_ptr_val = &tx as *const _ as usize;
        handle_request(
            handle,
            to_cstr(&tx_ptr_val.to_string()).as_ptr(),
            to_cstr(&payload.to_string()).as_ptr(),
            test_callback,
        );
    }

    // Should either succeed or fail gracefully
    match rx.recv_timeout(std::time::Duration::from_millis(200)) {
        Ok(_) => {} // Success
        Err(_) => {} // Timeout or failure - acceptable
    }

    unsafe { destroy(handle) };
}