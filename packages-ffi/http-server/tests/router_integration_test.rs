use bunner_http_server::router::{self, Router, RouterOptions};
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::collections::HashSet;

#[derive(Debug, Deserialize, Clone)]
struct RouteDef { method: Option<u32>, path: String }

fn build_router(case_sensitive: bool) -> Router {
    let opts = RouterOptions {
        ignore_trailing_slash: true,
        ignore_duplicate_slashes: true,
        case_sensitive,
        max_param_length: 100,
        allow_unsafe_regex: false,
    };
    Router::with_options(opts, None)
}

fn load_routes(limit: usize) -> Vec<RouteDef> {
    let json_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/routes.json");
    let bytes = fs::read(json_path).expect("routes.json missing");
    let mut routes: Vec<RouteDef> = serde_json::from_slice(&bytes).expect("routes.json invalid");
    if routes.len() > limit { routes.truncate(limit); }
    // default method to 0 if missing
    for r in routes.iter_mut() { if r.method.is_none() { r.method = Some(0); } }
    routes
}

fn try_register(r: &mut Router, m: u32, p: &str, k: u64) -> bool {
    let code = router::register_route_ex(r, m, p, k);
    match code { 0 => true, 1 => false, _ => panic!("register failed code={} path={}", code, p) }
}

fn is_static(p: &str) -> bool { !p.contains(":") && !p.contains('*') && !p.contains('(') }
fn has_wildcard(p: &str) -> bool { p.ends_with("/*") }
fn has_regex(p: &str) -> bool { p.contains('(') && p.contains(')') }
fn param_count(p: &str) -> usize { p.matches(':').count() }
fn depth(p: &str) -> usize { p.split('/').filter(|s| !s.is_empty()).count() }

fn supports_route(p: &str) -> bool {
    let parts: Vec<&str> = p.split('/').collect();
    for (i, seg) in parts.iter().enumerate() {
        if seg.is_empty() { continue; }
        if *seg == "*" && i != parts.len() - 1 { return false; }
        let colon_count = seg.matches(':').count();
        if colon_count > 1 { return false; }
        if let Some(pos) = seg.find(')') {
            // disallow another param after regex close in same segment
            if seg[pos+1..].contains(':') { return false; }
        }
    }
    true
}

fn pick_routes(routes: &[RouteDef]) -> (Vec<RouteDef>, Vec<RouteDef>, Vec<RouteDef>) {
    // simplest: pure static
    let mut simplest: Vec<&RouteDef> = routes.iter().filter(|r| is_static(&r.path)).collect();
    simplest.truncate(10);

    // most complex: high param_count + regex + deep
    let mut complex: Vec<&RouteDef> = routes.iter().collect();
    complex.sort_by_key(|r| {
        let score = (param_count(&r.path) as i32) * 10
            + (has_regex(&r.path) as i32) * 5
            + (has_wildcard(&r.path) as i32) * 7
            + (depth(&r.path) as i32);
        -score
    });
    complex.truncate(10);

    // typical: single param or shallow regex or simple static
    let mut typical: Vec<&RouteDef> = routes.iter()
        .filter(|r| param_count(&r.path) == 1 || (has_regex(&r.path) && depth(&r.path) <= 5) || is_static(&r.path))
        .collect();
    // ensure uniqueness across buckets
    let mut used = HashSet::new();
    for r in simplest.iter() { used.insert(&r.path); }
    for r in complex.iter() { used.insert(&r.path); }
    typical.retain(|r| !used.contains(&r.path));
    typical.truncate(10);

    (
        simplest.into_iter().map(|r| (*r).clone()).collect(),
        complex.into_iter().map(|r| (*r).clone()).collect(),
        typical.into_iter().map(|r| (*r).clone()).collect(),
    )
}

fn build_and_register_all(case_sensitive: bool) -> (Router, Vec<RouteDef>) {
    let routes = load_routes(5000);
    let mut r = build_router(case_sensitive);
    for (i, rd) in routes.iter().enumerate() {
        if supports_route(&rd.path) {
            let _ = try_register(&mut r, rd.method.unwrap_or(0), &rd.path, (100 + i) as u64);
        }
    }
    router::seal(&mut r);
    (r, routes)
}

#[test]
fn match_static_from_routes() {
    let (r, routes) = build_and_register_all(true);
    if let Some(st) = routes.iter().find(|rd| is_static(&rd.path)) {
        let hit = router::match_route(&r, st.method.unwrap_or(0), &st.path).expect("static not matched");
        assert!(hit.0 > 0);
        assert!(hit.1.is_empty());
    }
}

#[test]
fn match_param_numeric_from_routes() {
    let (r, routes) = build_and_register_all(true);
    if let Some(pr) = routes.iter().find(|rd| rd.path.contains(":") && rd.path.contains("\\d+") && supports_route(&rd.path)) {
        let sample = pr.path.replace(":id(\\d+)", "12345")
                            .replace(":n(\\d+)", "678")
                            .replace(":a(\\d+)", "42");
        let hit = router::match_route(&r, pr.method.unwrap_or(0), &sample).expect("param not matched");
        assert!(hit.0 > 0);
        assert!(!hit.1.is_empty());
    }
}

#[test]
fn match_regex_suffix_from_routes() {
    let (r, routes) = build_and_register_all(true);
    if let Some(rx) = routes.iter().find(|rd| rd.path.contains(".json") && rd.path.contains(":" ) && supports_route(&rd.path)) {
        let sample = rx.path.replace(":n(\\d+)\\.json", "789.json");
        let hit = router::match_route(&r, rx.method.unwrap_or(0), &sample).expect("regex+suffix not matched");
        assert!(hit.0 > 0);
    }
}

#[test]
fn match_wildcard_from_routes() {
    let (r, routes) = build_and_register_all(true);
    if let Some(wc) = routes.iter().find(|rd| has_wildcard(&rd.path) && supports_route(&rd.path)) {
        let base = wc.path.trim_end_matches("/*");
        let sample = format!("{}/some/deep/path", base);
        let hit = router::match_route(&r, wc.method.unwrap_or(0), &sample).expect("wildcard not matched");
        assert!(hit.0 > 0);
        let rest = hit.1.iter().find(|(k, _)| k == "*").map(|(_, v)| v.clone()).unwrap_or_default();
        assert!(rest.contains("some/deep/path"));
    }
}

#[test]
fn options_and_error_cases() {
    let mut r = build_router(false);
    // register conflicting param slot
    assert!(router::register_route(&mut r, 0, "/conflict/:id(\\d+)", 1));
    let err = router::register_route_ex(&mut r, 0, "/conflict/:name(\\w+)", 2);
    assert_ne!(err, 0, "conflict should fail");

    // unsafe regex blocked
    let err2 = router::register_route_ex(&mut r, 0, "/unsafe/:r((.+)+)", 3);
    assert_ne!(err2, 0, "unsafe regex should fail");

    // too long param should not match
    assert!(router::register_route(&mut r, 0, "/limit/:id(\\d+)", 10));
    router::seal(&mut r);
    let long = format!("/limit/{}", "9".repeat(200));
    assert!(router::match_route(&r, 0, &long).is_none());

    // case-insensitive: same route with capitals should match
    let mut r2 = build_router(false);
    assert!(router::register_route(&mut r2, 0, "/Case/Path/Abc", 20));
    router::seal(&mut r2);
    assert!(router::match_route(&r2, 0, "/case/path/abc").is_some());
}

#[test]
fn case_sensitive_static_exact() {
    let routes = load_routes(5000);
    let filtered: Vec<RouteDef> = routes.into_iter().filter(|r| supports_route(&r.path)).collect();
    let (simplest, complex, typical) = pick_routes(&filtered);
    let mut r_cs = build_router(true);
    for (i, rd) in simplest.iter().chain(complex.iter()).chain(typical.iter()).enumerate() {
        assert!(router::register_route(&mut r_cs, rd.method.unwrap_or(0), &rd.path, (i + 1) as u64));
    }
    router::seal(&mut r_cs);
    for rd in simplest.iter() {
        let hit = router::match_route(&r_cs, rd.method.unwrap_or(0), &rd.path).expect("static not matched (cs)");
        assert!(hit.0 > 0);
    }
}

#[test]
fn case_insensitive_static_lowercase() {
    let routes = load_routes(5000);
    let filtered: Vec<RouteDef> = routes.into_iter().filter(|r| supports_route(&r.path)).collect();
    let (simplest, complex, typical) = pick_routes(&filtered);
    let mut r_ci = build_router(false);
    for (i, rd) in simplest.iter().chain(complex.iter()).chain(typical.iter()).enumerate() {
        assert!(router::register_route(&mut r_ci, rd.method.unwrap_or(0), &rd.path, (10_000 + i) as u64));
    }
    router::seal(&mut r_ci);
    for rd in simplest.iter() {
        let lower = rd.path.to_ascii_lowercase();
        let hit = router::match_route(&r_ci, rd.method.unwrap_or(0), &lower).expect("static not matched (ci)");
        assert!(hit.0 > 0);
    }
}

#[test]
fn normalization_duplicate_slash_trailing() {
    let mut r_norm = Router::with_options(RouterOptions { ignore_trailing_slash: true, ignore_duplicate_slashes: true, case_sensitive: false, max_param_length: 100, allow_unsafe_regex: false }, None);
    assert!(router::register_route(&mut r_norm, 0, "/a/b/c", 1));
    router::seal(&mut r_norm);
    assert!(router::match_route(&r_norm, 0, "/a//b///c/").is_some());
}

#[test]
fn wildcard_capture_rest() {
    let mut r_wc = build_router(true);
    assert!(router::register_route(&mut r_wc, 0, "/wild/*", 1));
    router::seal(&mut r_wc);
    let hit = router::match_route(&r_wc, 0, "/wild/x/y").unwrap();
    assert_eq!(hit.1.iter().find(|(k, _)| k == "*").unwrap().1, "x/y");
}

#[test]
fn error_cases_conflict_wildcardpos_unsaferegex() {
    let mut r_err = build_router(true);
    assert!(router::register_route(&mut r_err, 0, "/conflict/:id(\\d+)", 1));
    assert_ne!(router::register_route_ex(&mut r_err, 0, "/conflict/:name(\\w+)", 2), 0);
    assert_ne!(router::register_route_ex(&mut r_err, 0, "/bad/*/tail", 3), 0);
    assert_ne!(router::register_route_ex(&mut r_err, 0, "/bad/:r(.+)+", 4), 0);
}

