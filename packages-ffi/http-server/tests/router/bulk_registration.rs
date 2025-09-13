#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::{
    self as rapi, Router, RouterErrorCode, RouterOptions,
};
use bunner_http_server::router::radix_tree::node::MAX_SEGMENT_LENGTH;

#[test]
fn bulk_register_static_route_root() {
    let mut r = Router::new(None);
    let out = r.add_bulk(vec![(HttpMethod::Get, "/".to_string())]);
    assert!(out.is_ok());
    assert_eq!(out.unwrap().len(), 1);
}

#[test]
fn bulk_register_static_route_nested_path() {
    let mut r = Router::new(None);
    let out = r.add_bulk(vec![
        (HttpMethod::Get, "/health".to_string()),
        (HttpMethod::Post, "/health".to_string()),
    ]);
    assert!(out.is_ok());
    assert_eq!(out.unwrap().len(), 2);
}

#[test]
fn bulk_register_parametric_route() {
    let mut r = rapi::Router::new(None);
    let out = r.add_bulk(vec![(HttpMethod::Get, "/users/:id".to_string())]);
    assert!(out.is_ok());
}

#[test]
fn bulk_register_wildcard_route() {
    let mut r = Router::new(None);
    let out = r.add_bulk(vec![(HttpMethod::Get, "/files/*".to_string())]);
    assert!(out.is_ok());
}

#[test]
fn bulk_register_multiple_and_preserve_order() {
    let mut r = Router::new(None);
    let entries = vec![
        (HttpMethod::Get, "/a".to_string()),
        (HttpMethod::Post, "/b".to_string()),
        (HttpMethod::Get, "/c/:id".to_string()),
        (HttpMethod::Get, "/d/*".to_string()),
        (HttpMethod::Get, "/".to_string()),
    ];
    let out = r.add_bulk(entries).unwrap();
    assert_eq!(out.len(), 5);
    // Keys should be in strictly increasing order starting from the current next key
    for w in out.windows(2) {
        assert_eq!(w[0] + 1, w[1]);
    }
}

#[test]
fn bulk_uses_multiple_workers_large_batch() {
    let mut r = Router::new(None);
    r.reset_bulk_metrics();
    let mut entries = Vec::new();
    for i in 0..50 {
        entries.push((HttpMethod::Get, format!("/c{i}")));
    }
    let _ = r.add_bulk(entries);
    let (used, max_active) = r.bulk_metrics();
    if used > 1 {
        assert!(max_active > 1);
    }
}

#[test]
fn bulk_uses_single_worker_tiny_batch() {
    let mut r = Router::new(None);
    r.reset_bulk_metrics();
    let _ = r.add_bulk(vec![(HttpMethod::Get, "/t1".to_string())]);
    let (used, _max_active) = r.bulk_metrics();
    assert_eq!(used, 1);
}

#[test]
fn bulk_fail_empty_path() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathEmpty)
    );
}

#[test]
fn bulk_fail_non_ascii_path() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/café".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathNotAscii)
    );
}

#[test]
fn bulk_fail_disallowed_chars_in_path() {
    let mut r = rapi::Router::new(None);
    for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
        assert_eq!(
            r.add_bulk(vec![(HttpMethod::Get, (*p).to_string())])
                .map_err(|e| e.code),
            Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
        );
    }
}

#[test]
fn bulk_fail_invalid_path_syntax() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/a/:()".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathSyntaxInvalid)
    );
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/users/:".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RoutePathSyntaxInvalid)
    );
}

#[test]
fn bulk_fail_param_name_invalid_start() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/:1bad".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidStart)
    );
}

#[test]
fn bulk_fail_param_name_invalid_chars() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/:bad-name".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidChar)
    );
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/:file.zip".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameInvalidChar)
    );
}

#[test]
fn bulk_fail_segment_mixed_literal_and_param() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/user-:id".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteSegmentContainsMixedParamAndLiteral)
    );
}

#[test]
fn bulk_fail_param_name_duplicated_across_segments() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/a/:x/b/:x".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteDuplicateParamNameInRoute)
    );
}

#[test]
fn bulk_fail_wildcard_not_at_end() {
    let mut r = rapi::Router::new(None);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/a/*/b".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardSegmentNotAtEnd)
    );
}

#[test]
fn bulk_fail_duplicate_static_path() {
    let mut r = rapi::Router::new(None);
    let res = r.add_bulk(vec![
        (HttpMethod::Get, "/dup".to_string()),
        (HttpMethod::Get, "/dup".to_string()),
    ]);
    assert_eq!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::RouteConflictOnDuplicatePath)
    );
}

#[test]
fn bulk_fail_all_or_nothing_on_error() {
    let mut r = rapi::Router::new(None);
    let res = r.add_bulk(vec![
        (HttpMethod::Get, "/ok".to_string()),
        (HttpMethod::Get, "/a/*/b".to_string()), // invalid wildcard position
    ]);
    assert_eq!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardSegmentNotAtEnd)
    );
    r.finalize();
    let ro = r.build_readonly();
    assert_eq!(
        ro.find(HttpMethod::Get, "/ok").map_err(|e| e.code),
        Err(RouterErrorCode::MatchNotFound),
        "no partial commit should have occurred",
    );
}

#[test]
fn bulk_fail_max_routes_limit_no_partial_commit() {
    let opts = RouterOptions::default();
    let mut r = Router::new(Some(opts));
    // build entries intentionally exceeding the test MAX_ROUTES(100)
    let entries: Vec<(HttpMethod, String)> = (0..=150)
        .map(|i| (HttpMethod::Get, format!("/r{i}")))
        .collect();
    let res = r.add_bulk(entries);
    assert!(matches!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::MaxRoutesExceeded)
    ));
    r.finalize();
    let ro = r.build_readonly();
    assert_eq!(
        ro.find(HttpMethod::Get, "/r0").map_err(|e| e.code),
        Err(RouterErrorCode::MatchNotFound),
        "no routes should be visible after overflow error",
    );
}

#[test]
fn bulk_fail_conflicting_parameter_names() {
    let mut r = rapi::Router::new(None);
    let res = r.add_bulk(vec![
        (HttpMethod::Get, "/users/:id".to_string()),
        (HttpMethod::Get, "/users/:name".to_string()),
    ]);
    assert_eq!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::RouteParamNameConflictAtSamePosition)
    );
}

#[test]
fn bulk_fail_duplicate_wildcard() {
    let mut r = rapi::Router::new(None);
    let res = r.add_bulk(vec![
        (HttpMethod::Get, "/a/*".to_string()),
        (HttpMethod::Get, "/a/*".to_string()),
    ]);
    assert_eq!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::RouteWildcardAlreadyExistsForMethod)
    );
}

#[test]
fn bulk_fail_router_finalized() {
    let mut r = rapi::Router::new(None);
    r.add(HttpMethod::Get, "/ok").unwrap();
    r.finalize();
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, "/x".to_string())])
            .map_err(|e| e.code),
        Err(RouterErrorCode::RouterSealedCannotInsert)
    );
}

#[test]
fn bulk_fail_max_routes_limit_exceeded() {
    let opts = RouterOptions::default();
    let mut r = Router::new(Some(opts));
    let entries: Vec<(HttpMethod, String)> = (0..=100)
        .map(|i| (HttpMethod::Get, format!("/route{}", i)))
        .collect();
    let res = r.add_bulk(entries);
    assert!(matches!(
        res.map_err(|e| e.code),
        Err(RouterErrorCode::MaxRoutesExceeded)
    ));
}

#[test]
fn bulk_fail_segment_literal_too_long() {
    let mut r = rapi::Router::new(None);
    let long_segment = "a".repeat(MAX_SEGMENT_LENGTH + 1);
    let path = format!("/{}", long_segment);
    assert_eq!(
        r.add_bulk(vec![(HttpMethod::Get, path)])
            .map_err(|e| e.code),
        Err(RouterErrorCode::PatternTooLong)
    );
}
