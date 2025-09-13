#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::Router;

#[test]
fn ignores_trailing_slashes() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/api/users").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    assert!(ro.find(HttpMethod::Get, "/api/users/").is_ok());
    assert!(ro.find(HttpMethod::Get, "/api/users").is_ok());
}

#[test]
fn treats_duplicate_slashes_as_part_of_path() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/a/b").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    assert!(ro.find(HttpMethod::Get, "/a//b").is_err());
}

#[test]
fn is_always_case_sensitive() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/About").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    assert!(ro.find(HttpMethod::Get, "/about").is_err());
    assert!(ro.find(HttpMethod::Get, "/About").is_ok());
}

#[test]
fn allows_matching_before_finalization() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/ok").unwrap();
    let ro = r.build_readonly();
    assert!(ro.find(HttpMethod::Get, "/ok").is_ok());
}

#[test]
fn supports_all_standard_http_methods() {
    let mut r = Router::new(None);

    // Add routes for different HTTP methods
    r.add(HttpMethod::Get, "/resource").unwrap();
    r.add(HttpMethod::Post, "/resource").unwrap();
    r.add(HttpMethod::Put, "/resource").unwrap();
    r.add(HttpMethod::Delete, "/resource").unwrap();
    r.add(HttpMethod::Patch, "/resource").unwrap();
    r.add(HttpMethod::Options, "/resource").unwrap();
    r.add(HttpMethod::Head, "/resource").unwrap();

    r.finalize();
    let ro = r.build_readonly();

    // Test that each method finds its route
    assert!(ro.find(HttpMethod::Get, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Post, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Put, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Delete, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Patch, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Options, "/resource").is_ok());
    assert!(ro.find(HttpMethod::Head, "/resource").is_ok());
}

#[test]
fn method_specific_routing_works_correctly() {
    let mut r = Router::new(None);

    // Different routes for different methods
    r.add(HttpMethod::Get, "/users").unwrap();
    r.add(HttpMethod::Post, "/users").unwrap();
    r.add(HttpMethod::Get, "/users/:id").unwrap();
    r.add(HttpMethod::Put, "/users/:id").unwrap();
    r.add(HttpMethod::Delete, "/users/:id").unwrap();

    r.finalize();
    let ro = r.build_readonly();

    // Test method-specific routing
    assert!(ro.find(HttpMethod::Get, "/users").is_ok());
    assert!(ro.find(HttpMethod::Post, "/users").is_ok());
    assert!(ro.find(HttpMethod::Get, "/users/123").is_ok());
    assert!(ro.find(HttpMethod::Put, "/users/123").is_ok());
    assert!(ro.find(HttpMethod::Delete, "/users/123").is_ok());

    // Wrong method should fail
    assert!(ro.find(HttpMethod::Post, "/users/123").is_err());
    assert!(ro.find(HttpMethod::Put, "/users").is_err());
}
