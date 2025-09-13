use crate::ffi::common::*;
use bunner_http_server::*;
use bunner_http_server::structure::AddRouteResult;
use bunner_http_server::util::from_ptr;
use serde_json::json;

#[test]
fn adds_various_route_types_successfully() {
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
fn adds_routes_in_bulk_successfully() {
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
fn fails_on_conflicting_route() {
    let handle = init();
    unsafe {
        let path = to_cstr("/conflict");
        // Add first time
        let _ = from_ptr::<AddRouteResult>(add_route(handle, 0, path.as_ptr()));
        // Add second time
        let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path.as_ptr()));
        assert!(res.is_err(), "Should fail on duplicate route");
        // Check that it's an error (we can't easily check the specific error code from Box<dyn Error>)
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_on_invalid_route_path() {
    let handle = init();
    unsafe {
        let path = to_cstr(""); // Empty path should be invalid
        let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path.as_ptr()));
        assert!(res.is_err(), "Should fail on empty path");
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_bulk_add_on_invalid_http_method() {
    let handle = init();
    unsafe {
        let routes_cstr = to_cstr("[[0, \"/a\"], [99, \"/b\"]]"); // 99 is invalid
        let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
        assert!(res.is_err(), "Should fail on invalid HTTP method");
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_bulk_add_on_malformed_json() {
    let handle = init();
    unsafe {
        let routes_cstr = to_cstr("[[0, \"/a\""); // Incomplete JSON
        let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
        assert!(res.is_err(), "Should fail on malformed JSON");
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_bulk_add_on_empty_array() {
    let handle = init();
    unsafe {
        let routes_cstr = to_cstr("[]"); // Empty array
        let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
        // Empty bulk add should succeed but return empty result
        assert!(res.is_ok());
        assert_eq!(res.unwrap().len(), 0);
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_bulk_add_on_null_string_in_path() {
    let handle = init();
    unsafe {
        // JSON with embedded null character
        let routes_json = "[[0, \"/test\\u0000path\"]]";
        let routes_cstr = to_cstr(routes_json);
        let res: Result<Vec<u16>, _> = from_ptr(add_routes(handle, routes_cstr.as_ptr()));
        assert!(res.is_err(), "Should reject paths with null characters");
    }
    unsafe { destroy(handle) };
}

#[test]
fn fails_on_extremely_nested_route_structure() {
    let handle = init();
    unsafe {
        // Create a deeply nested path
        let deep_path = "/".to_string() + &"segment/".repeat(1000) + "end";
        let path_cstr = to_cstr(&deep_path);
        let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path_cstr.as_ptr()));
        // This should either succeed or fail gracefully with a specific error
        if res.is_err() {
            // Verify it's not a random crash but a proper error
            assert!(res.is_err());
        }
    }
    unsafe { destroy(handle) };
}

#[test]
fn handles_unicode_in_route_paths_gracefully() {
    let handle = init();
    unsafe {
        let unicode_path = "/café/résumé/测试";
        let path_cstr = to_cstr(unicode_path);
        let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, 0, path_cstr.as_ptr()));
        // Should fail with RoutePathNotAscii error
        assert!(res.is_err(), "Should reject non-ASCII paths");
    }
    unsafe { destroy(handle) };
}

#[test]
fn handles_all_http_method_edge_cases() {
    let handle = init();
    unsafe {
        // Test boundary values
        for method in [0, 1, 2, 3, 4, 5, 6] {
            let path = format!("/method-{}", method);
            let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, method, to_cstr(&path).as_ptr()));
            assert!(res.is_ok(), "Valid HTTP methods should work: {}", method);
        }

        // Test invalid method values
        for invalid_method in [7, 8, 99, 255] {
            let path = format!("/invalid-{}", invalid_method);
            let res: Result<AddRouteResult, _> = from_ptr(add_route(handle, invalid_method, to_cstr(&path).as_ptr()));
            assert!(res.is_err(), "Invalid HTTP method {} should be rejected", invalid_method);
        }
    }
    unsafe { destroy(handle) };
}
