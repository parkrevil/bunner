use bunner_http_server::enums::HttpStatusCode;
use bunner_http_server::errors::HttpServerErrorCode;
use bunner_http_server::request_handler;
use bunner_http_server::router::RouterErrorCode;
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::HandleRequestOutput;
use serde_json::json;
use std::ffi::{CStr, c_char};
use std::sync::{Arc, mpsc};

mod common;
use common::make_req_id;

// --- Test Setup & Helpers ---

extern "C" fn test_callback(req_id_ptr: *const c_char, _route_key: u16, res_ptr: *mut c_char) {
    let req_id_str = unsafe { CStr::from_ptr(req_id_ptr).to_str().unwrap() };
    let res_str = unsafe { CStr::from_ptr(res_ptr).to_str().unwrap().to_owned() };
    let tx_ptr = req_id_str.parse::<usize>().unwrap();
    let tx = unsafe { &*(tx_ptr as *const mpsc::Sender<String>) };
    tx.send(res_str).unwrap();
    unsafe { bunner_http_server::free_string(res_ptr) };
}

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
    let (tx, rx) = mpsc::channel::<String>();
    let req_id = make_req_id(&tx);
    request_handler::process_job(test_callback, req_id, payload.to_string(), ro);
    let out: HandleRequestOutput = serde_json::from_str(&rx.recv().unwrap()).unwrap();
    out
}

fn run_test_and_get_error_code(payload: serde_json::Value) -> u16 {
    let ro = setup_router();
    let (tx, rx) = mpsc::channel::<String>();
    let req_id = make_req_id(&tx);
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
        let out = run_test_and_get_result(payload);
        let query = out.request.query_params.unwrap();
        assert_eq!(query.get("search").unwrap(), "test");
        assert_eq!(query.get("page").unwrap(), "2");
    }

    #[test]
    fn should_parse_array_query_parameters() {
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
    fn should_parse_nested_object_query_parameters() {
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
    fn should_parse_json_body() {
        let payload = json!({
            "httpMethod": 0,
            "url": "https://example.com/users/42",
            "headers": {},
            "body": "{\"value\": true, \"nested\": {\"key\": 123}}"
        });
        let out = run_test_and_get_result(payload);
        let body = out.request.body.unwrap();
        assert_eq!(body.get("value").unwrap(), true);
        assert_eq!(body.get("nested").unwrap().get("key").unwrap(), 123);
    }

    #[test]
    fn should_handle_empty_query_and_body() {
        let payload =
            json!({"httpMethod": 0, "url": "http://[::1]/users/ipv6", "headers": {}, "body": null});
        let out = run_test_and_get_result(payload);
        assert!(out.request.query_params.is_none());
        assert!(out.request.body.is_none());
    }

    #[test]
    fn should_pass_through_non_json_body_as_string() {
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

    mod body_fallbacks {
        use super::*;

        #[test]
        fn should_fallback_to_string_when_json_content_type_but_invalid_json() {
            let payload = json!({
                "httpMethod": 0,
                "url": "http://a.com/users/1",
                "headers": { "content-type": "application/json" },
                "body": "{invalid}"
            });
            let out = super::run_test_and_get_result(payload);
            assert_eq!(
                out.response.http_status,
                HttpStatusCode::UnsupportedMediaType
            );
            assert_eq!(
                out.response.body,
                json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
            );
        }
    }
}

mod header_parsing {
    use super::*;

    #[test]
    fn should_parse_cookies() {
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
    fn should_parse_content_type_and_charset() {
        let payload = json!({
            "httpMethod": 0, "url": "http://a.com/users/1",
            "headers": { "content-type": "application/json; charset=utf-8" }, "body": null
        });
        let out = run_test_and_get_result(payload);
        assert_eq!(out.request.content_type.unwrap(), "application/json");
        assert_eq!(out.request.charset.unwrap(), "utf-8");
    }

    #[test]
    fn should_not_include_request_headers_in_output_json() {
        let payload = json!({
            "httpMethod": 0, "url": "http://a.com/users/1",
            "headers": { "x-custom": "v1", "content-type": "text/plain" }, "body": null
        });
        let raw = run_test_and_get_result(payload);
        let serialized = serde_json::to_value(&raw.request).unwrap();

        assert!(serialized.get("headers").is_none());
    }
}

mod routing_logic {
    use super::*;

    #[test]
    fn should_match_static_route() {
        let payload =
            json!({"httpMethod": 0, "url": "http://localhost/static", "headers": {}, "body": null});
        let out = run_test_and_get_result(payload);
        assert!(out.request.params.is_none());
    }

    #[test]
    fn should_match_parameterized_route_and_extract_param() {
        let payload = json!({"httpMethod": 0, "url": "https://example.com/users/12345", "headers": {}, "body": null});
        let out = run_test_and_get_result(payload);
        assert_eq!(out.request.params.unwrap().get("id").unwrap(), "12345");
    }

    #[test]
    fn should_match_wildcard_route_and_extract_path() {
        let payload = json!({"httpMethod": 1, "url": "http://test.com/files/path/to/my/file.txt", "headers": {}, "body": null});
        let out = run_test_and_get_result(payload);
        assert_eq!(
            out.request.params.unwrap().get("*").unwrap(),
            "path/to/my/file.txt"
        );
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
        assert_eq!(code, HttpServerErrorCode::InvalidJsonString.code());
    }

    #[test]
    fn should_fail_on_payload_missing_required_fields() {
        let payload = json!({"httpMethod": 0, "headers": {}, "body": null}); // Missing "url"
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, HttpServerErrorCode::InvalidJsonString.code());
    }

    #[test]
    fn should_fail_on_malformed_url() {
        let payload = json!({"httpMethod": 0, "url": "://bad-url", "headers": {}, "body": null});
        let out = super::run_test_and_get_result(payload);
        assert_eq!(out.response.http_status, HttpStatusCode::BadRequest);
        assert_eq!(
            out.response.body,
            json!(HttpStatusCode::BadRequest.reason_phrase())
        );
    }

    #[test]
    fn should_fail_when_route_is_not_found() {
        let payload = json!({"httpMethod": 0, "url": "http://a.com/this/route/does/not/exist", "headers": {}, "body": null});
        let code = run_test_and_get_error_code(payload);
        assert_eq!(code, RouterErrorCode::MatchNotFound.code());
    }

    #[test]
    fn should_fail_on_invalid_querystring_format() {
        let payload = json!({"httpMethod": 0, "url": "http://a.com/users/1?a[=malformed", "headers": {}, "body": null});
        let out = super::run_test_and_get_result(payload);
        assert_eq!(out.response.http_status, HttpStatusCode::BadRequest);
        assert_eq!(
            out.response.body,
            json!(HttpStatusCode::BadRequest.reason_phrase())
        );
    }
}
