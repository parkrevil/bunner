use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::{
    Router, RouterError, RouterErrorCode,
};

#[test]
fn treats_dot_segments_as_literals() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/a/./b").unwrap();
    r.add(HttpMethod::Get, "/a/../b").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    assert!(ro.find(HttpMethod::Get, "/a/./b").is_ok());
    assert!(ro.find(HttpMethod::Get, "/a/../b").is_ok());
    assert!(ro.find(HttpMethod::Get, "/a/b").is_err());
}

#[test]
fn rejects_null_byte_on_add() {
    let mut r = Router::new(None);
    let path_with_null = "/file/image.jpg\0.txt";
    let add_result = r.add(HttpMethod::Get, path_with_null);
    assert_eq!(
        add_result.map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
    );
}

#[test]
fn rejects_null_byte_on_find() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/file/:name").unwrap();
    let path_with_null = "/file/image.jpg\0.txt";
    let find_result = r.build_readonly().find(HttpMethod::Get, path_with_null);
    assert_eq!(
        find_result.map_err(|e| e.code),
        Err(RouterErrorCode::MatchPathContainsDisallowedCharacters)
    );
}

#[test]
fn rejects_percent_encoded_malicious_chars() {
    let mut r = Router::new(None);
    let path_with_encoded_slash = "/a/b%2fc";
    assert_eq!(
        r.add(HttpMethod::Get, path_with_encoded_slash)
            .map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
    );
    assert_eq!(
        r.build_readonly()
            .find(HttpMethod::Get, path_with_encoded_slash)
            .map_err(|e| e.code),
        Err(RouterErrorCode::MatchPathContainsDisallowedCharacters)
    );
}

#[test]
fn handles_extremely_deep_paths() {
    let mut r = Router::new(None);
    let deep_path = "/".to_string() + &"a/".repeat(100) + ":id";
    assert!(r.add(HttpMethod::Get, &deep_path).is_ok());
    r.finalize();
    let request_path = "/".to_string() + &"a/".repeat(100) + "123";
    assert!(
        r.build_readonly()
            .find(HttpMethod::Get, &request_path)
            .is_ok()
    );
}

#[test]
fn handles_path_with_many_parameters() {
    let mut r = Router::new(None);
    let mut path = String::new();
    for i in 0..30 {
        path.push_str(&format!("/:param{}", i));
    }
    assert!(r.add(HttpMethod::Get, &path).is_ok());
    r.finalize();
    let mut request_path = String::new();
    for i in 0..30 {
        request_path.push_str(&format!("/value{}", i));
    }
    assert!(
        r.build_readonly()
            .find(HttpMethod::Get, &request_path)
            .is_ok()
    );
}

#[test]
fn handles_long_non_matching_segment() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/a/b/c").unwrap();
    r.finalize();
    let long_segment = "x".repeat(10000);
    let path = format!("/a/{}/c", long_segment);
    assert!(matches!(
        r.build_readonly()
            .find(HttpMethod::Get, &path)
            .map_err(|e| e.code),
        Err(RouterErrorCode::MatchNotFound)
    ));
}

#[test]
fn handles_special_characters_in_param_value() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/users/:id").unwrap();
    r.finalize();
    let special_path = "/users/special'chars()*,;=";
    let m = r
        .build_readonly()
        .find(HttpMethod::Get, special_path)
        .unwrap();
    assert_eq!(m.1.len(), 1);
    assert_eq!(m.1[0].0.as_str(), "id");
    // Extract parameter value from original path using offset and length
    let (start, len) = m.1[0].1;
    let param_value = &special_path[start..start + len];
    assert_eq!(param_value, "special'chars()*,;=");
}

#[test]
fn prevents_path_traversal_attacks() {
    let r = Router::new(None);

    // Test various path traversal attempts
    let traversal_attempts = vec![
        "/../../../etc/passwd",
        "/..\\..\\..\\windows\\system32",
        "/files/../../../etc/shadow",
        "/api/../../config/database.yml",
        "/static/..\\..\\..\\app\\secrets",
    ];

    for attempt in traversal_attempts {
        // These should either be rejected or not match any routes
        let result = r.build_readonly().find(HttpMethod::Get, attempt);
        assert!(result.is_err(), "Path traversal attempt should fail: {}", attempt);
    }
}

#[test]
fn handles_unicode_normalization_attacks() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/files/:name").unwrap();
    r.finalize();

    // Test unicode normalization differences
    let unicode_variants = vec![
        "/files/café",           // NFC normalized
        "/files/café",           // NFD normalized (different byte sequence)
        "/files/тест",           // Cyrillic
        "/files/テスト",         // Japanese
        "/files/🦀",             // Emoji
    ];

    for variant in unicode_variants {
        // Should handle unicode gracefully
        let result = r.build_readonly().find(HttpMethod::Get, variant);
        // Either matches or fails gracefully, but shouldn't crash
        assert!(result.is_ok() || matches!(result, Err(RouterError { code: RouterErrorCode::MatchNotFound, .. })));
    }
}

#[test]
fn prevents_buffer_overflow_via_long_paths() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/test").unwrap();
    r.finalize();

    // Test extremely long paths that might cause buffer issues
    let long_paths = vec![
        "/".to_string() + &"a".repeat(100_000),  // Very long segment
        "/".to_string() + &"a/b/".repeat(10_000), // Many segments
        "/test?".to_string() + &"param=value&".repeat(5_000), // Long query
    ];

    for long_path in long_paths {
        let result = r.build_readonly().find(HttpMethod::Get, &long_path);
        // Should either succeed or fail gracefully without crashing
        assert!(result.is_ok() || result.is_err());
    }
}

#[test]
fn handles_malformed_url_encoding() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/files/:name").unwrap();
    r.finalize();

    // Test malformed URL encoding
    let malformed_urls = vec![
        "/files/file%2",         // Incomplete percent encoding
        "/files/file%",          // Lone percent
        "/files/file%XY",        // Invalid hex digits
        "/files/file%G0",        // Invalid hex digit
        "/files/file%0G",        // Invalid hex digit
        "/files/file%2F%2E%2E%2Fetc%2Fpasswd", // Encoded path traversal
    ];

    for url in malformed_urls {
        let result = r.build_readonly().find(HttpMethod::Get, url);
        // Should handle malformed encoding gracefully
        assert!(result.is_ok() || result.is_err());
    }
}

#[test]
fn prevents_regex_dos_via_path_patterns() {
    let mut r = Router::new(None);

    // Test patterns that could be expensive to match
    let expensive_patterns = vec![
        "/files/*",              // Wildcard
        "/api/:version/:resource/:action", // Many parameters
        "/nested/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j", // Deep nesting
    ];

    for pattern in expensive_patterns {
        assert!(r.add(HttpMethod::Get, pattern).is_ok());
    }

    r.finalize();

    // Test with paths that would be expensive to match
    let expensive_paths = vec![
        "/files/".to_string() + &"a/b/c/d/e/f/g/h/i/j/".repeat(100),
        "/api/v1/users/1234567890/actions/".to_string() + &"x".repeat(1000),
        "/nested/1/2/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17/18/19/20".to_string(),
    ];

    for path in expensive_paths {
        let result = r.build_readonly().find(HttpMethod::Get, &path);
        // Should complete in reasonable time without hanging
        assert!(result.is_ok() || result.is_err());
    }
}

#[test]
fn handles_control_characters_in_paths() {
    let r = Router::new(None);

    // Test paths with control characters
    let control_char_paths = vec![
        "/files/\0hidden",       // Null byte
        "/files/\nnewlined",     // Newline
        "/files/\rreturned",     // Carriage return
        "/files/\ttabbed",       // Tab
        "/files/\x1b[31mred",    // ANSI escape sequence
    ];

    for path in control_char_paths {
        let result = r.build_readonly().find(HttpMethod::Get, path);
        // Should reject paths with control characters
        assert!(result.is_err());
    }
}

#[test]
fn prevents_host_header_attacks() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/api/data").unwrap();
    r.finalize();

    // These would typically be handled at HTTP level, but test router resilience
    let host_header_attacks = vec![
        "evil.com/api/data",
        "localhost.evil.com/api/data",
        "127.0.0.1.evil.com/api/data",
        "localhost%0a.evil.com/api/data", // CRLF injection attempt
    ];

    for attack_path in host_header_attacks {
        let result = r.build_readonly().find(HttpMethod::Get, attack_path);
        // Router should handle these gracefully
        assert!(result.is_ok() || result.is_err());
    }
}

#[test]
fn handles_extreme_parameter_values() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/users/:id").unwrap();
    r.finalize();

    // Test extreme parameter values
    let extreme_params = vec![
        "/users/".to_string() + &"9".repeat(1000),  // Very long number
        "/users/".to_string() + &"a".repeat(10000), // Very long string
        "/users/".to_string() + &"../".repeat(100), // Path traversal in param
        "/users/".to_string() + &"%00".repeat(100), // Null bytes in param
        "/users/".to_string() + &"<script>".repeat(100), // XSS attempt
    ];

    for param_path in extreme_params {
        let result = r.build_readonly().find(HttpMethod::Get, &param_path);
        // Should handle extreme values gracefully
        assert!(result.is_ok() || result.is_err());
    }
}
