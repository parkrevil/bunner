use bunner_http_server::structure::{AddRouteResult, HandleRequestResult};
use bunner_http_server::*;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::ffi::{c_char, CStr, CString};
use std::ptr::null_mut;
use std::sync::{mpsc, Arc, Barrier};
mod common;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct FfiError {
    code: u16,
    message: Option<String>,
}

fn to_cstr(s: &str) -> CString {
    CString::new(s).unwrap()
}

unsafe fn from_ptr<'a, T: Deserialize<'a>>(ptr: *mut c_char) -> Result<T, FfiError> {
    let s = unsafe {
        let c_str = CStr::from_ptr(ptr);
        c_str.to_str().unwrap()
    };
    let res: Result<T, FfiError> = serde_json::from_str(s).map_err(|_| {
        serde_json::from_str::<FfiError>(s).unwrap_or(FfiError {
            code: 0,
            message: Some("unknown json parse error".to_string()),
        })
    });
    unsafe { free_string(ptr) };
    res
}

extern "C" fn test_callback(req_id_ptr: *const c_char, res_ptr: *mut c_char) {
    let req_id_str = unsafe { CStr::from_ptr(req_id_ptr).to_str().unwrap() };
    if req_id_str.is_empty() {
        return;
    }
    let res_str = unsafe { CStr::from_ptr(res_ptr).to_str().unwrap().to_owned() };
    let tx_ptr = req_id_str.parse::<usize>().unwrap();
    let tx = unsafe { &*(tx_ptr as *const mpsc::Sender<String>) };
    tx.send(res_str).unwrap();
    unsafe { free_string(res_ptr) };
}

// --- Test Modules (Domain-Driven) ---

use common as helpers;

mod lifecycle_management {
    use super::*;
    use std::ptr::null_mut;

    #[test]
    fn should_initialize_and_destroy_server_instance() {
        let handle = init();
        assert!(!handle.is_null(), "init() should return a valid handle");
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_not_panic_when_destroying_a_null_handle() {
        // This test ensures that calling destroy with a null pointer is safe and does not crash.
        unsafe { destroy(null_mut()) };
    }

    #[test]
    fn should_return_handle_is_null_error_when_handle_is_null() {
        let out = helpers::with_capture(|cb| unsafe {
            handle_request(std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), cb);
        });
        let res: FfiError = serde_json::from_str(&out).unwrap();
        assert_eq!(res.code, 1);
    }
}

mod route_management {
    use super::*;

    #[test]
    fn should_add_various_route_types_successfully() {
        let handle = init();
        unsafe {
            let res_static: Result<AddRouteResult, _> =
                from_ptr(add_route(handle, 0, to_cstr("/static").as_ptr()));
            assert!(res_static.is_ok());

            let res_param: Result<AddRouteResult, _> =
                from_ptr(add_route(handle, 0, to_cstr("/users/:id").as_ptr()));
            assert!(res_param.is_ok());

            let res_wildcard: Result<AddRouteResult, _> =
                from_ptr(add_route(handle, 1, to_cstr("/files/*").as_ptr()));
            assert!(res_wildcard.is_ok());
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_add_routes_in_bulk_successfully() {
        let handle = init();
        unsafe {
            let routes_json = json!([[0, "/a"], [1, "/b"], [0, "/users/:id"]]).to_string();
            let res: Result<Vec<u16>, _> =
                from_ptr(add_routes(handle, to_cstr(&routes_json).as_ptr()));
            assert!(res.is_ok(), "Bulk route addition should succeed");
            assert_eq!(res.unwrap().len(), 3, "Should return 3 route keys");
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_on_conflicting_route() {
        let handle = init();
        unsafe {
            let path = to_cstr("/conflict");
            // Add first time
            let _ = from_ptr::<AddRouteResult>(add_route(handle, 0, path.as_ptr()));
            // Add second time
            let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path.as_ptr()));
            assert_eq!(res.unwrap_err().code, 10001, "Should return a conflict error");
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_on_invalid_route_path() {
        let handle = init();
        unsafe {
            let path = to_cstr("/a//b"); // Contains empty segment
            let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path.as_ptr()));
            assert_eq!(res.unwrap_err().code, 10002, "Should return an invalid path error");
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_bulk_add_on_invalid_http_method() {
        let handle = init();
        unsafe {
            let routes_cstr = to_cstr("[[0, \"/a\"], [99, \"/b\"]]"); // 99 is invalid
            let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
            assert_eq!(res.unwrap_err().code, 3, "Should return invalid http method error");
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_bulk_add_on_malformed_json() {
        let handle = init();
        unsafe {
            let routes_cstr = to_cstr("[[0, \"/a\""); // Incomplete JSON
            let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
            assert_eq!(res.unwrap_err().code, 4, "Should return invalid json error");
        }
        unsafe { destroy(handle) };
    }
}

mod router_sealing {
    use super::*;

    #[test]
    fn should_prevent_adding_routes_after_sealing() {
        let handle = init();
        unsafe {
            add_route(handle, 0, to_cstr("/before").as_ptr());
            router_seal(handle); // Seal the router

            let res: Result<AddRouteResult, _> =
                from_ptr(add_route(handle, 0, to_cstr("/after").as_ptr()));
            assert_eq!(
                res.unwrap_err().code,
                10006, // RouterSealedCannotInsert
                "Should not be able to add routes after sealing"
            );
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_not_panic_on_double_seal() {
        let handle = init();
        unsafe {
            router_seal(handle);
            router_seal(handle); // Calling seal a second time should be a safe no-op
        }
        unsafe { destroy(handle) };
    }
}

mod request_processing {
    use super::*;

    #[test]
    fn should_handle_a_valid_request_successfully() {
        let handle = init();
        let (tx, rx) = mpsc::channel::<String>();
        unsafe {
            add_route(handle, 0, to_cstr("/users/:id").as_ptr());
            router_seal(handle);

            let payload = json!({
                "httpMethod": 0,
                "url": "http://localhost/users/123?q=test",
                "headers": { "x-forwarded-for": "1.2.3.4" },
                "body": "{\"key\":\"val\"}"
            })
            .to_string();
            let tx_ptr_val = &tx as *const _ as usize;
            handle_request(
                handle,
                to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                to_cstr(&payload).as_ptr(),
                test_callback,
            );

            let res_str = rx.recv().unwrap();
            let res: HandleRequestResult = serde_json::from_str(&res_str).unwrap();
            assert_eq!(res.route_key, 0);
            assert_eq!(res.params.unwrap()["id"], "123");
            assert_eq!(res.query_params.unwrap()["q"], "test");
            assert_eq!(res.body.unwrap()["key"], "val");
            assert_eq!(res.ip, "1.2.3.4");
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_return_invalid_request_id_on_non_utf8_request_id() {
        let handle = init();
        let out = helpers::with_capture(|cb| {
            let bad_ptr: *mut u8 = unsafe { libc::malloc(2) as *mut u8 };
            unsafe {
                *bad_ptr.offset(0) = 0xFF;
                *bad_ptr.offset(1) = 0x00;
                handle_request(handle, bad_ptr as *const c_char, std::ptr::null(), cb);
                libc::free(bad_ptr as *mut libc::c_void);
            }
        });
        let res: FfiError = serde_json::from_str(&out).unwrap();
        assert_eq!(res.code, 5);
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_return_queue_full_when_pool_is_saturated() {
        bunner_http_server::thread_pool_test_support::set_force_full(true);

        let handle = init();
        unsafe {
            add_route(handle, 0, to_cstr("/a").as_ptr());
            router_seal(handle);
        }

        let payload = json!({
            "httpMethod": 0,
            "url": "http://localhost/a",
            "headers": {},
            "body": null
        })
        .to_string();

        let out = helpers::with_capture(|cb| unsafe {
            let dummy_req = to_cstr("qfull");
            handle_request(handle, dummy_req.as_ptr(), to_cstr(&payload).as_ptr(), cb);
        });
        let res: FfiError = serde_json::from_str(&out).unwrap();
        assert_eq!(res.code, 9);

        unsafe { destroy(handle) };

        // Reset the forced state
        bunner_http_server::thread_pool_test_support::set_force_full(false);
    }

    #[test]
    fn should_fail_if_router_is_not_sealed() {
        let handle = init();
        let (tx, rx) = mpsc::channel::<String>();
        unsafe {
            add_route(handle, 0, to_cstr("/some/route").as_ptr());
            // Router is NOT sealed
            let payload =
                json!({ "httpMethod": 0, "url": "http://localhost/some/route", "headers": {}, "body": null })
                    .to_string();
            let tx_ptr_val = &tx as *const _ as usize;
            handle_request(
                handle,
                to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                to_cstr(&payload).as_ptr(),
                test_callback,
            );
            let res: FfiError = serde_json::from_str(&rx.recv().unwrap()).unwrap();
            assert_eq!(res.code, 8, "Should return RouteNotSealed error"); // RouteNotSealed
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_if_no_route_matches() {
        let handle = init();
        let (tx, rx) = mpsc::channel::<String>();
        unsafe {
            router_seal(handle); // Seal with no routes
            let payload =
                json!({ "httpMethod": 0, "url": "http://localhost/nomatch", "headers": {}, "body": null })
                    .to_string();
            let tx_ptr_val = &tx as *const _ as usize;
            handle_request(
                handle,
                to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                to_cstr(&payload).as_ptr(),
                test_callback,
            );
            let res: FfiError = serde_json::from_str(&rx.recv().unwrap()).unwrap();
            assert_eq!(res.code, 10101, "Should return MatchNotFound error"); // MatchNotFound
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_fail_gracefully_on_null_payload() {
        let handle = init();
        let (tx, rx) = mpsc::channel::<String>();
        unsafe {
            router_seal(handle);
            let tx_ptr_val = &tx as *const _ as usize;
            handle_request(
                handle,
                to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                null_mut(), // Pass null pointer for payload
                test_callback,
            );
            let res: FfiError = serde_json::from_str(&rx.recv().unwrap()).unwrap();
            assert_eq!(res.code, 10, "Should return InvalidPayload error"); // InvalidPayload
        }
        unsafe { destroy(handle) };
    }

    #[test]
    fn should_not_crash_on_null_request_id() {
        let handle = init();
        let out = helpers::with_capture(|cb| {
            unsafe {
                router_seal(handle);
                let payload = json!({ "httpMethod": 0, "url": "http://localhost/a", "headers": {}, "body": null }).to_string();
                handle_request(handle, null_mut(), to_cstr(&payload).as_ptr(), cb);
            }
        });
        let res: FfiError = serde_json::from_str(&out).unwrap();
        assert_eq!(res.code, 5);
        unsafe { destroy(handle) };
    }
}

mod concurrency {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn should_handle_concurrent_requests_correctly() {
        let handle = init();
        let (tx, rx) = mpsc::channel::<String>();

        unsafe {
            add_route(handle, 0, to_cstr("/users/:id").as_ptr());
            router_seal(handle);
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

                    let tx_ptr_val = &tx_clone as *const _ as usize;

                    unsafe {
                        let handle = handle_addr as *mut HttpServer;
                        handle_request(
                            handle,
                            to_cstr(&tx_ptr_val.to_string()).as_ptr(),
                            to_cstr(&payload).as_ptr(),
                            test_callback,
                        );
                    }
                }
            });
        }

        let mut results: HashMap<String, usize> = HashMap::new();
        for _ in 0..(num_threads * num_reqs_per_thread) {
            let res_str = rx.recv().unwrap();
            let res: HandleRequestResult = serde_json::from_str(&res_str).unwrap();
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
}
