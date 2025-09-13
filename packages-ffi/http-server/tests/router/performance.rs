#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::radix_tree::node::MAX_SEGMENT_LENGTH;
use bunner_http_server::router::{
    self as rapi, Router, RouterError, RouterErrorCode, RouterOptions,
};
use std::time::{Duration, Instant};

#[test]
fn handles_deep_recursion_gracefully() {
    let mut r = Router::new(None);
    // Create very deep nested structure
    let segments: Vec<String> = (0..1000).map(|i| format!("level{}", i)).collect();
    let deep_path = "/".to_string() + &segments.join("/");
    
    let result = r.add(HttpMethod::Get, &deep_path);
    // Should either work or fail gracefully without stack overflow
    if result.is_err() {
        assert!(result.unwrap_err().code as u16 > 0);
    }
}

#[test]
fn handles_wide_branching_gracefully() {
    let mut r = Router::new(None);
    // Create many routes at same level
    for i in 0..10000 {
        let path = format!("/branch{}", i);
        let result = r.add(HttpMethod::Get, &path);
        if result.is_err() {
            // Hit memory or route limit
            assert!(result.unwrap_err().code as u16 > 0);
            break;
        }
    }
}

#[test]
fn handles_complex_pattern_combinations() {
    let mut r = Router::new(None);
    
    // Mix of static, parametric, and wildcard routes
    let patterns = vec![
        "/static/path",
        "/users/:id",
        "/files/*",
        "/api/v1/users/:userId/posts/:postId",
        "/complex/:a/:b/:c/:d/:e",
        "/mixed/static/:param/more/static/*",
    ];
    
    for pattern in patterns {
        assert!(r.add(HttpMethod::Get, pattern).is_ok());
        assert!(r.add(HttpMethod::Post, pattern).is_ok());
        assert!(r.add(HttpMethod::Put, pattern).is_ok());
    }
    
    r.finalize();
    let ro = r.build_readonly();
    
    // Test that all patterns still work after complex setup
    assert!(ro.find(HttpMethod::Get, "/static/path").is_ok());
    assert!(ro.find(HttpMethod::Get, "/users/123").is_ok());
    assert!(ro.find(HttpMethod::Get, "/files/any/path/here").is_ok());
}

#[test]
fn routing_completes_within_reasonable_time() {
    let mut r = Router::new(None);
    
    // Add many routes
    for i in 0..1000 {
        r.add(HttpMethod::Get, &format!("/route{}", i)).unwrap();
    }
    r.finalize();
    let ro = r.build_readonly();
    
    // Test that lookup is fast
    let start = Instant::now();
    for i in 0..1000 {
        let _ = ro.find(HttpMethod::Get, &format!("/route{}", i));
    }
    let elapsed = start.elapsed();
    
    // Should complete within reasonable time (adjust threshold as needed)
    assert!(elapsed < Duration::from_millis(100), "Routing took too long: {:?}", elapsed);
}

#[test]
fn handles_concurrent_access_without_deadlock() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/test/:id").unwrap();
    r.finalize();
    let ro = std::sync::Arc::new(r.build_readonly());
    
    let handles: Vec<_> = (0..10).map(|i| {
        let ro_clone = ro.clone();
        std::thread::spawn(move || {
            for j in 0..100 {
                let path = format!("/test/{}", i * 100 + j);
                let _ = ro_clone.find(HttpMethod::Get, &path);
            }
        })
    }).collect();
    
    // Should complete without hanging
    for handle in handles {
        assert!(handle.join().is_ok());
    }
}
