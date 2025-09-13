#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::{
    Router, RouterOptions,
};

#[test]
fn is_functionally_equivalent_root_pruning() {
    let mut o1 = RouterOptions::default();
    o1.enable_root_level_pruning = true;
    let mut r1 = Router::new(Some(o1));
    r1.add(HttpMethod::Get, "/x/:p").unwrap();
    r1.add(HttpMethod::Get, "/y/static").unwrap();
    r1.finalize();

    let mut o2 = RouterOptions::default();
    o2.enable_root_level_pruning = false;
    let mut r2 = Router::new(Some(o2));
    r2.add(HttpMethod::Get, "/x/:p").unwrap();
    r2.add(HttpMethod::Get, "/y/static").unwrap();
    r2.finalize();

    for p in ["/x/abc", "/y/static", "/zzz"].iter() {
        let ro1 = r1.build_readonly();
        let ro2 = r2.build_readonly();
        assert_eq!(
            ro1.find(HttpMethod::Get, p).is_ok(),
            ro2.find(HttpMethod::Get, p).is_ok()
        );
    }
}

#[test]
fn is_functionally_equivalent_static_map() {
    let mut o1 = RouterOptions::default();
    o1.enable_static_route_full_mapping = true;
    let mut r1 = Router::new(Some(o1));
    r1.add(HttpMethod::Get, "/s/a").unwrap();
    r1.add(HttpMethod::Get, "/s/b").unwrap();
    r1.finalize();

    let mut o2 = RouterOptions::default();
    o2.enable_static_route_full_mapping = false;
    let mut r2 = Router::new(Some(o2));
    r2.add(HttpMethod::Get, "/s/a").unwrap();
    r2.add(HttpMethod::Get, "/s/b").unwrap();
    r2.finalize();

    for p in ["/s/a", "/s/b", "/s/x"].iter() {
        let ro1 = r1.build_readonly();
        let ro2 = r2.build_readonly();
        assert_eq!(
            ro1.find(HttpMethod::Get, p).is_ok(),
            ro2.find(HttpMethod::Get, p).is_ok()
        );
    }
}

#[test]
fn enables_root_pruning_when_no_root_dynamics() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/static").unwrap();
    r.add(HttpMethod::Get, "/another").unwrap();
    r.finalize();
    assert!(r.get_internal_radix_router().enable_root_level_pruning);
}

#[test]
fn disables_root_pruning_when_root_is_dynamic() {
    let mut r_param = Router::new(None);
    r_param.add(HttpMethod::Get, "/:id").unwrap();
    r_param.finalize();
    assert!(
        !r_param
            .get_internal_radix_router()
            .enable_root_level_pruning
    );

    let mut r_wildcard = Router::new(None);
    r_wildcard.add(HttpMethod::Get, "/*").unwrap();
    r_wildcard.finalize();
    assert!(
        !r_wildcard
            .get_internal_radix_router()
            .enable_root_level_pruning
    );
}

#[test]
fn enables_static_map_when_threshold_is_met() {
    let mut r = Router::new(None);
    for i in 0..50 {
        r.add(HttpMethod::Get, &format!("/static/{}", i)).unwrap();
    }
    r.finalize();
    assert!(
        r.get_internal_radix_router()
            .enable_static_route_full_mapping
    );
}

#[test]
fn respects_manual_disable_override() {
    let mut opts = RouterOptions::default();
    opts.enable_automatic_optimization = false;
    let mut r = Router::new(Some(opts));
    for i in 0..50 {
        r.add(HttpMethod::Get, &format!("/static/{}", i)).unwrap();
    }
    r.finalize();
    assert!(!r.get_internal_radix_router().enable_root_level_pruning);
    assert!(
        !r.get_internal_radix_router()
            .enable_static_route_full_mapping
    );
}
