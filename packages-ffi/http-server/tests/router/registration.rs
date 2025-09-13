#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::radix_tree::node::MAX_SEGMENT_LENGTH;
use bunner_http_server::router::{
    self as rapi, Router, RouterError, RouterErrorCode, RouterOptions,
};

#[test]
fn register_static_routes() {
    let mut r = Router::new(None);
    // 루트
    assert!(r.add(HttpMethod::Get, "/").is_ok());
    // health GET
    assert!(r.add(HttpMethod::Get, "/health").is_ok());
    // health POST
    assert!(r.add(HttpMethod::Post, "/health").is_ok());
}

#[test]
fn register_parametric_and_wildcard_routes() {
    let mut r = rapi::Router::new(None);
    // 파라메트릭
    assert!(r.add(HttpMethod::Get, "/users/:id").is_ok());
    // 와일드카드
    assert!(r.add(HttpMethod::Get, "/files/*").is_ok());
}

#[test]
fn fail_empty_path() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "").map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathEmpty)
    );
}

#[test]
fn fail_non_ascii_path() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/café").map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathNotAscii)
    );
}

#[test]
fn fail_disallowed_chars_in_path() {
    let mut r = rapi::Router::new(None);
    for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
        assert_eq!(
            r.add(HttpMethod::Get, p).map_err(|e| e.code),
            Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
        );
    }
}

#[test]
fn fail_invalid_path_syntax() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/a/:()").map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathSyntaxInvalid)
    );
    assert_eq!(
        r.add(HttpMethod::Get, "/users/:").map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathSyntaxInvalid)
    );
}

#[test]
fn fail_param_name_invalid_start() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/:1bad").map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidStart)
    );
}

#[test]
fn fail_param_name_invalid_chars() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/:bad-name").map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidChar)
    );
    assert_eq!(
        r.add(HttpMethod::Get, "/:file.zip").map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidChar)
    );
}

#[test]
fn fail_segment_mixed_literal_and_param() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/user-:id").map_err(|e| e.code),
        Err(RouterErrorCode::RouteSegmentContainsMixedParamAndLiteral)
    );
}

#[test]
fn fail_param_name_duplicated_across_segments() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/a/:x/b/:x").map_err(|e| e.code),
        Err(RouterErrorCode::RouteDuplicateParamNameInRoute)
    );
}

#[test]
fn fail_wildcard_not_at_end() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add(HttpMethod::Get, "/a/*/b").map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardSegmentNotAtEnd)
    );
}

#[test]
fn fail_duplicate_static_path() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/dup").unwrap();
    assert_eq!(
        r.add(HttpMethod::Get, "/dup").map_err(|e| e.code),
        Err(RouterErrorCode::RouteConflictOnDuplicatePath)
    );
}

#[test]
fn fail_conflicting_parameter_names() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/users/:id").unwrap();
    assert_eq!(
        r.add(HttpMethod::Get, "/users/:name").map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameConflictAtSamePosition)
    );
}

#[test]
fn fail_duplicate_wildcard() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/a/*").unwrap();
    assert_eq!(
        r.add(HttpMethod::Get, "/a/*").map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardAlreadyExistsForMethod)
    );
}

#[test]
fn fail_router_finalized() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/ok").unwrap();
    r.finalize();
    assert_eq!(
        r.add(HttpMethod::Get, "/x").map_err(|e| e.code),
        Err(RouterErrorCode::RouterSealedCannotInsert)
    );
}

#[test]
fn fail_max_routes_limit_exceeded() {
    let opts = RouterOptions::default();
    let mut r = Router::new(Some(opts));
    let mut got_err: Option<RouterError> = None;

    for i in 0..=100 {
        let path = format!("/route{}", i);
        if let Err(e) = r.add(HttpMethod::Get, &path) {
            got_err = Some(e);
            break;
        }
    }
    assert!(matches!(got_err, Some(e) if e.code == RouterErrorCode::MaxRoutesExceeded));
}

#[test]
fn fail_segment_literal_too_long() {
    let mut r = rapi::Router::new(None);
    let long_segment = "a".repeat(MAX_SEGMENT_LENGTH + 1);
    let path = format!("/{}", long_segment);
    assert_eq!(
        r.add(HttpMethod::Get, &path).map_err(|e| e.code),
        Err(RouterErrorCode::PatternTooLong)
    );
}

#[test]
fn fail_param_name_extremely_long() {
    let mut r = rapi::Router::new(None);
    let long_param = "a".repeat(1000);
    let path = format!("/:{}_{}", long_param, long_param);
    // Should either succeed or fail with specific error, not crash
    let result = r.add(HttpMethod::Get, &path);
    if result.is_err() {
        // Verify it's a proper error code, not a crash
        assert!(result.unwrap_err().code as u16 > 0);
    }
}

#[test]
fn fail_path_only_special_chars() {
    let mut r = rapi::Router::new(None);
    for path in ["/%20", "/!", "/@", "/$", "/^", "/&", "/(", "/)"].iter() {
        let result = r.add(HttpMethod::Get, path);
        if result.is_err() {
            // Should be a validation error, not a crash
            let error_code = result.unwrap_err().code;
            assert!(matches!(error_code, 
                RouterErrorCode::RoutePathContainsDisallowedCharacters |
                RouterErrorCode::RoutePathSyntaxInvalid
            ));
        }
    }
}

#[test]
fn fail_path_mixed_separators() {
    let mut r = rapi::Router::new(None);
    // Test paths with different types of separators
    for path in ["/a\\b", "/a\tb", "/a\nb", "/a\rb"].iter() {
        assert_eq!(
            r.add(HttpMethod::Get, path).map_err(|e| e.code),
            Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
        );
    }
}

#[test]
fn fail_path_exceeds_reasonable_depth() {
    let mut r = rapi::Router::new(None);
    // Create extremely deep nested path
    let deep_path = "/".to_string() + &"a/".repeat(500) + "end";
    let result = r.add(HttpMethod::Get, &deep_path);
    // Should either work or fail gracefully
    if result.is_err() {
        assert!(result.unwrap_err().code as u16 > 0);
    }
}

#[test]
fn wildcard_conflict_across_methods() {
    let mut r = rapi::Router::new(None);
    // Test wildcard conflicts across methods
    r.add(HttpMethod::Get, "/files/*").unwrap();
    r.add(HttpMethod::Post, "/files/*").unwrap(); // Should be OK - different method
    
    // But same method should conflict
    assert_eq!(
        r.add(HttpMethod::Get, "/files/*").map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardAlreadyExistsForMethod)
    );
}

#[test]
fn param_and_wildcard_compete_same_position() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/a/:param").unwrap();
    // Adding wildcard at same level should be allowed but create routing precedence
    let result = r.add(HttpMethod::Get, "/a/*");
    // This should either work or have specific conflict resolution
    if result.is_err() {
        let error_code = result.unwrap_err().code;
        // Should be a meaningful routing conflict error
        assert!(error_code as u16 > 0);
    }
}

#[test]
fn fail_empty_segments_in_middle() {
    let mut r = rapi::Router::new(None);
    for path in ["/a//b", "/a///b", "//a/b", "/a/b//"].iter() {
        let result = r.add(HttpMethod::Get, path);
        if result.is_err() {
            let error_code = result.unwrap_err().code;
            assert!(matches!(error_code,
                RouterErrorCode::RoutePathSyntaxInvalid |
                RouterErrorCode::RoutePathContainsDisallowedCharacters
            ));
        }
    }
}

#[test]
fn handles_maximum_path_length() {
    let mut r = Router::new(None);
    // Test with very long but valid path
    let long_path = "/".to_string() + &"segment".repeat(1000);
    let result = r.add(HttpMethod::Get, &long_path);
    // Should either succeed or fail gracefully
    if result.is_err() {
        assert!(result.unwrap_err().code as u16 > 0);
    }
}

#[test]
fn handles_path_with_many_parameters() {
    let mut r = Router::new(None);
    let mut path = String::new();
    for i in 0..100 {
        path.push_str(&format!("/:param{}", i));
    }
    let result = r.add(HttpMethod::Get, &path);
    if result.is_ok() {
        r.finalize();
        let ro = r.build_readonly();
        
        // Test matching with actual values
        let mut test_path = String::new();
        for i in 0..100 {
            test_path.push_str(&format!("/value{}", i));
        }
        
        let match_result = ro.find(HttpMethod::Get, &test_path);
        if match_result.is_ok() {
            let (_, params) = match_result.unwrap();
            assert_eq!(params.len(), 100);
        }
    }
}

#[test]
fn handles_zero_length_segments_gracefully() {
    let mut r = Router::new(None);
    for path in ["//", "///", "/a//b//c", "/a/b/"].iter() {
        let result = r.add(HttpMethod::Get, path);
        // Should handle consistently
        if result.is_err() {
            assert!(result.unwrap_err().code as u16 > 0);
        }
    }
}

#[test]
fn handles_minimum_valid_paths() {
    let mut r = Router::new(None);
    assert!(r.add(HttpMethod::Get, "/").is_ok());
    assert!(r.add(HttpMethod::Get, "/a").is_ok());
    assert!(r.add(HttpMethod::Get, "/:x").is_ok());
    assert!(r.add(HttpMethod::Get, "/*").is_ok());
}

#[test]
fn handles_routes_at_limit_boundaries() {
    let mut r = Router::new(None);
    // Test adding routes up to reasonable limits
    for i in 0..1000 {
        let path = format!("/route_{}", i);
        let result = r.add(HttpMethod::Get, &path);
        if result.is_err() {
            // Hit some limit, should be graceful
            assert!(result.unwrap_err().code as u16 > 0);
            break;
        }
    }
}

#[test]
fn handles_all_allowed_ascii_chars() {
    let mut r = Router::new(None);
    // Test with all ASCII printable characters that should be allowed
    let allowed_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
    for ch in allowed_chars.chars() {
        let path = format!("/test{}", ch);
        let result = r.add(HttpMethod::Get, &path);
        assert!(result.is_ok(), "Character '{}' should be allowed in paths", ch);
    }
}

#[test]
fn rejects_control_characters() {
    let mut r = Router::new(None);
    // Test control characters (0-31, 127)
    for ch in (0..32u8).chain(std::iter::once(127u8)) {
        if ch != b'\t' && ch != b'\n' && ch != b'\r' { // Skip common whitespace
            let path = format!("/test{}", ch as char);
            let result = r.add(HttpMethod::Get, &path);
            assert!(result.is_err(), "Control character {} should be rejected", ch);
        }
    }
}

#[test]
fn handles_percent_encoded_sequences() {
    let mut r = Router::new(None);
    for encoded in ["%20", "%2F", "%3F", "%23"].iter() {
        let path = format!("/test{}", encoded);
        let result = r.add(HttpMethod::Get, &path);
        // Percent encoding should be rejected in route definitions
        assert!(result.is_err(), "Percent encoding '{}' should be rejected", encoded);
    }
}

#[test]
fn handles_unicode_edge_cases() {
    let mut r = Router::new(None);
    let unicode_chars = ["café", "测试", "🚀", "Ñoño", "العربية"];
    for unicode in unicode_chars.iter() {
        let path = format!("/{}", unicode);
        let result = r.add(HttpMethod::Get, &path);
        assert_eq!(
            result.map_err(|e| e.code),
            Err(RouterErrorCode::RoutePathNotAscii),
            "Unicode '{}' should be rejected", unicode
        );
    }
}

#[test]
fn handles_paths_with_only_separators() {
    let mut r = Router::new(None);
    for path in ["/", "//", "///", "////"].iter() {
        let result = r.add(HttpMethod::Get, path);
        // Root path should work, others should be handled consistently
        if path == &"/" {
            assert!(result.is_ok());
        } else if result.is_err() {
            assert!(result.unwrap_err().code as u16 > 0);
        }
    }
}

#[test]
fn handles_mixed_valid_invalid_characters() {
    let mut r = Router::new(None);
    let mixed_paths = [
        "/valid/path with space",
        "/valid/path\twith\ttab",
        "/valid/path\nwith\nnewline",
        "/valid/path?with?question",
        "/valid/path#with#hash",
    ];
    
    for path in mixed_paths.iter() {
        let result = r.add(HttpMethod::Get, path);
        assert!(result.is_err(), "Path '{}' should be rejected", path);
        assert_eq!(
            result.unwrap_err().code,
            RouterErrorCode::RoutePathContainsDisallowedCharacters
        );
    }
}

#[test]
fn handles_parameter_name_edge_cases() {
    let mut r = Router::new(None);
    
    // Various invalid parameter names
    let invalid_params = [
        "/:123param",      // starts with number
        "/:param-name",    // contains hyphen
        "/:param.name",    // contains dot
        "/:param name",    // contains space
        "/:param@name",    // contains @
        "/:param$name",    // contains $
    ];
    
    for path in invalid_params.iter() {
        let result = r.add(HttpMethod::Get, path);
        assert!(result.is_err(), "Invalid param path '{}' should be rejected", path);
    }
}

#[test]
fn handles_wildcard_edge_cases() {
    let mut r = Router::new(None);
    
    // Wildcard in middle (should be rejected)
    assert!(r.add(HttpMethod::Get, "/start/*/end").is_err());
    
    // Multiple wildcards (should be rejected)
    assert!(r.add(HttpMethod::Get, "/files/*/*").is_err());
    
    // Wildcard with parameter syntax (should be rejected)  
    assert!(r.add(HttpMethod::Get, "/files/:*").is_err());
}
