use bunner_http_server::request_handler;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::HandleRequestResult;
use serde_json::json;
use std::ffi::{c_char, CStr};
use std::sync::{mpsc, Arc};

// --- Test Setup & Helpers ---

extern "C" fn test_callback(req_id_ptr: *const c_char, res_ptr: *mut c_char) {
    let req_id_str = unsafe { CStr::from_ptr(req_id_ptr).to_str().unwrap() };
    let res_str = unsafe { CStr::from_ptr(res_ptr).to_str().unwrap().to_owned() };
    let tx_ptr = req_id_str.parse::<usize>().unwrap();
    let tx = unsafe { &*(tx_ptr as *const mpsc::Sender<String>) };
    tx.send(res_str).unwrap();
    unsafe { bunner_http_server::free_string(res_ptr) };
}

fn setup_router() -> Arc<RouterReadOnly> {
    let mut router = Router::new(Some(RouterOptions::default()));
    router.add(bunner_http_server::r#enum::HttpMethod::Get, "/users/:id").unwrap();
    router.add(bunner_http_server::r#enum::HttpMethod::Post, "/files/*").unwrap();
    router.add(bunner_http_server::r#enum::HttpMethod::Get, "/static").unwrap();
    router.finalize();
    Arc::new(router.build_readonly())
}

fn run_test_and_get_result(payload: serde_json::Value) -> HandleRequestResult {
    let ro = setup_router();
    let (tx, rx) = mpsc::channel::<String>();
    let tx_ptr_val = &tx as *const _ as usize;
    let req_id = tx_ptr_val.to_string();
    request_handler::process_job(test_callback, req_id, payload.to_string(), ro);
    serde_json::from_str(&rx.recv().unwrap()).unwrap()
}

fn run_test_and_get_error_code(payload: serde_json::Value) -> u16 {
    let ro = setup_router();
    let (tx, rx) = mpsc::channel::<String>();
    let tx_ptr_val = &tx as *const _ as usize;
    let req_id = tx_ptr_val.to_string();
    request_handler::process_job(test_callback, req_id, payload.to_string(), ro);
    let res: serde_json::Value = serde_json::from_str(&rx.recv().unwrap()).unwrap();
    res.get("code").unwrap().as_u64().unwrap() as u16
}


// --- Test Modules (Domain-Driven) ---

mod request_parsing {
    use super::*;

    #[test]
    fn should_parse_query_parameters() {
        let payload = json!({
            "httpMethod": 0,
            "url": "https://example.com/users/42?search=test&page=2",
            "headers": {}, "body": null
        });
        let res = run_test_and_get_result(payload);
        let query = res.query_params.unwrap();
        assert_eq!(query.get("search").unwrap(), "test");
        assert_eq!(query.get("page").unwrap(), "2");
    }

    #[test]
    fn should_parse_json_body() {
        let payload = json!({
            "httpMethod": 0,
            "url": "https://example.com/users/42",
            "headers": {},
            "body": "{\"value\": true, \"nested\": {\"key\": 123}}"
        });
        let res = run_test_and_get_result(payload);
        let body = res.body.unwrap();
        assert_eq!(body.get("value").unwrap(), true);
        assert_eq!(body.get("nested").unwrap().get("key").unwrap(), 123);
    }

    #[test]
    fn should_handle_empty_query_and_body() {
        let payload = json!({"httpMethod": 0, "url": "http://[::1]/users/ipv6", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert!(res.query_params.is_none());
        assert!(res.body.is_none());
    }

    #[test]
    fn should_pass_through_non_json_body_as_string() {
        let payload = json!({
            "httpMethod": 0,
            "url": "http://a.com/users/1",
            "headers": {},
            "body": "this is plain text"
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.body.unwrap().as_str().unwrap(), "this is plain text");
    }
}

mod header_parsing {
    use super::*;

    #[test]
    fn should_resolve_ip_from_x_forwarded_for() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": { "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.ip, "1.1.1.1");
        assert_eq!(res.ip_version, 4);
    }

    #[test]
    fn should_resolve_ip_from_x_real_ip() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": { "x-real-ip": "3.3.3.3" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.ip, "3.3.3.3");
    }

    #[test]
    fn should_resolve_localhost_ip_from_url_host() {
        let payload = json!({"httpMethod": 0, "url": "http://localhost/users/1", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert_eq!(res.ip, "127.0.0.1");
    }

    #[test]
    fn should_resolve_ipv6_from_url_host() {
        let payload = json!({"httpMethod": 0, "url": "http://[::1]/users/1", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert_eq!(res.ip, "::1");
        assert_eq!(res.ip_version, 6);
    }

    #[test]
    fn should_parse_protocol_from_x_forwarded_proto() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": { "x-forwarded-proto": "https" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.http_protocol, "https");
    }

    #[test]
    fn should_parse_protocol_from_x_forwarded_protocol_alias() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": { "x-forwarded-protocol": "https" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.http_protocol, "https");
    }

    #[test]
    fn should_parse_http_version_from_header() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": { "x-http-version": "2.0" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.http_version, "2.0");
    }

    #[test]
    fn should_default_http_version_when_header_missing() {
        let payload = json!({
            "httpMethod": 0, "url": "http://test.com/users/1",
            "headers": {}, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.http_version, "1.1");
    }

    #[test]
    fn should_parse_cookies() {
        let payload = json!({
            "httpMethod": 0, "url": "http://a.com/users/1",
            "headers": { "cookie": "a=1; b=2; c=3" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        let cookies = res.cookies;
        assert_eq!(cookies.get("a").unwrap(), "1");
        assert_eq!(cookies.get("b").unwrap(), "2");
        assert_eq!(cookies.get("c").unwrap(), "3");
    }

    #[test]
    fn should_parse_content_type_and_charset() {
        let payload = json!({
            "httpMethod": 0, "url": "http://a.com/users/1",
            "headers": { "content-type": "application/json; charset=utf-8" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.content_type, "application/json");
        assert_eq!(res.charset, "utf-8");
    }

    #[test]
    fn should_echo_input_headers_in_result_headers() {
        let payload = json!({
            "httpMethod": 0, "url": "http://a.com/users/1",
            "headers": { "x-custom": "v1", "content-type": "text/plain" }, "body": null
        });
        let res = run_test_and_get_result(payload);
        assert_eq!(res.headers.get("x-custom").unwrap(), "v1");
        assert_eq!(res.content_type, "text/plain");
    }
}

mod routing_logic {
    use super::*;

    #[test]
    fn should_match_static_route() {
        let payload = json!({"httpMethod": 0, "url": "http://localhost/static", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert_eq!(res.route_key, 2);
        assert!(res.params.is_none());
    }

    #[test]
    fn should_match_parameterized_route_and_extract_param() {
        let payload = json!({"httpMethod": 0, "url": "https://example.com/users/12345", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert_eq!(res.route_key, 0);
        assert_eq!(res.params.unwrap().get("id").unwrap(), "12345");
    }

    #[test]
    fn should_match_wildcard_route_and_extract_path() {
        let payload = json!({"httpMethod": 1, "url": "http://test.com/files/path/to/my/file.txt", "headers": {}, "body": null});
        let res = run_test_and_get_result(payload);
        assert_eq!(res.route_key, 1);
        assert_eq!(res.params.unwrap().get("*").unwrap(), "path/to/my/file.txt");
    }
}

mod error_handling {
    use super::*;

    #[test]
    fn should_fail_on_invalid_payload_json() {
        // This test needs to construct an invalid string manually, as json!() macro creates valid json
        let ro = setup_router();
        let (tx, rx) = mpsc::channel::<String>();
        let req_id = (&tx as *const _ as usize).to_string();
        let payload_str = "{ \"httpMethod\": 0, ".to_string(); // Incomplete JSON

        request_handler::process_job(test_callback, req_id, payload_str, ro);

        let res: serde_json::Value = serde_json::from_str(&rx.recv().unwrap()).unwrap();
        let code = res.get("code").unwrap().as_u64().unwrap() as u16;
        assert_eq!(code, 4); // InvalidJsonString
    }

    #[test]
    fn should_fail_on_payload_missing_required_fields() {
        let payload = json!({"httpMethod": 0, "headers": {}, "body": null}); // Missing "url"
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, 4); // InvalidJsonString from serde deserialization failure
    }

    #[test]
    fn should_fail_on_malformed_url() {
        let payload = json!({"httpMethod": 0, "url": "://bad-url", "headers": {}, "body": null});
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, 6); // InvalidUrl
    }

    #[test]
    fn should_fail_when_route_is_not_found() {
        let payload = json!({"httpMethod": 0, "url": "http://a.com/this/route/does/not/exist", "headers": {}, "body": null});
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, 10101); // MatchNotFound from RouterError
    }

    #[test]
    fn should_fail_on_invalid_querystring_format() {
        let payload = json!({"httpMethod": 0, "url": "http://a.com/users/1?a[=malformed", "headers": {}, "body": null});
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, 7); // InvalidQueryString
    }
}
