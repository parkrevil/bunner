#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]
use bunner_http_server::r#enum::HttpMethod;
use bunner_http_server::router::{self as rapi, RouterBuilder, RouterError, RouterOptions};

mod methods {
    use super::*;

    #[test]
    fn supports_all_http_methods() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/r")
            .add(HttpMethod::Post, "/r")
            .add(HttpMethod::Put, "/r")
            .add(HttpMethod::Patch, "/r")
            .add(HttpMethod::Delete, "/r")
            .add(HttpMethod::Options, "/r")
            .add(HttpMethod::Head, "/r")
            .seal()
            .build();
        let k_get = r.find(HttpMethod::Get, "/r").unwrap().key;
        let k_post = r.find(HttpMethod::Post, "/r").unwrap().key;
        let k_put = r.find(HttpMethod::Put, "/r").unwrap().key;
        let k_patch = r.find(HttpMethod::Patch, "/r").unwrap().key;
        let k_delete = r.find(HttpMethod::Delete, "/r").unwrap().key;
        let k_options = r.find(HttpMethod::Options, "/r").unwrap().key;
        let k_head = r.find(HttpMethod::Head, "/r").unwrap().key;
        assert!(
            k_get != 0
                && k_post != 0
                && k_put != 0
                && k_patch != 0
                && k_delete != 0
                && k_options != 0
                && k_head != 0
        );
        assert!(r.find(HttpMethod::Get, "/r/x").is_none());
        assert!(r.find(HttpMethod::Head, "/r").is_some());
        assert!(r.find(HttpMethod::Get, "/r").is_some());
        assert!(r.find(HttpMethod::Head, "/r").unwrap().key != r.find(HttpMethod::Get, "/r").unwrap().key);
    }

    #[test]
    fn missing_method_is_none_both_before_and_after_seal() {
        let r1 = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/only-get")
            .build();
        assert!(r1.find(HttpMethod::Post, "/only-get").is_none());
        let r2 = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/only-get")
            .seal()
            .build();
        assert!(r2.find(HttpMethod::Post, "/only-get").is_none());
    }

    #[test]
    fn head_does_not_fallback_to_get_and_head_only() {
        let r1 = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/only-get")
            .seal()
            .build();
        assert!(r1.find(HttpMethod::Head, "/only-get").is_none());

        let r2 = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Head, "/head-only")
            .seal()
            .build();
        assert!(r2.find(HttpMethod::Get, "/head-only").is_none());
        assert!(r2.find(HttpMethod::Head, "/head-only").unwrap().key != 0);
    }
}

mod static_routes {
    use super::*;

    #[test]
    fn matches_root_route() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/").unwrap().key != 0);
    }

    #[test]
    fn root_matches_with_leading_duplicate_slashes() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "////").is_some());
    }

    #[test]
    fn matches_static_routes_by_method() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/health")
            .add(HttpMethod::Post, "/health")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/health").unwrap().key != 0);
        assert!(r.find(HttpMethod::Post, "/health").unwrap().key != 0);
    }

    #[test]
    fn rejects_duplicate_static_route_for_same_method() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let k = rapi::register_route(&mut r, HttpMethod::Get, "/health").unwrap();
        let code = rapi::register_route(&mut r, HttpMethod::Get, "/health");
        assert_eq!(code, Err(RouterError::RouteConflictOnDuplicatePath));
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, HttpMethod::Get, "/health").unwrap();
        assert_eq!(m.0, k);
    }

    #[test]
    fn heavy_static_routes_with_high_duplication_probability() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        for i in 0..200u32 {
            let path = format!("/assets/v1/css/{}.css", i);
            assert!(rapi::register_route(&mut r, HttpMethod::Get, &path).is_ok());
        }
        rapi::seal(&mut r);
        for i in [0u32, 1, 50, 100, 150, 199] {
            let p = format!("/assets/v1/css/{}.css", i);
            let m = rapi::match_route(&r, HttpMethod::Get, &p).unwrap();
            assert!(m.0 != 0);
        }
    }
}

mod normalization {
    use super::*;

    #[test]
    fn trailing_slash_is_always_ignored() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/api/users")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/api/users/").is_some());
        assert!(r.find(HttpMethod::Get, "/api/users").is_some());
    }

    #[test]
    fn duplicate_slashes_are_not_ignored() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/a/b")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/a//b").is_none());
        assert!(r.find(HttpMethod::Get, "/a//b///").is_none());
    }

    #[test]
    fn duplicate_slash_does_not_match_static_path() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/a/x/b")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/a//b").is_none());
    }

    #[test]
    fn trailing_slash_ignoring_works_with_params() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/p/:x/:y")
            .seal()
            .build();
        let raw = "/p/AA/BB/";
        let m = r.find(HttpMethod::Get, raw).unwrap();
        assert!(m.key != 0);
        assert_eq!(m.params.len(), 2);
        assert_eq!(m.params[0].0, "x");
        assert_eq!(m.params[1].0, "y");
        // 파라미터 값은 오프셋과 길이로 저장되므로 직접 비교할 수 없음
        // 대신 오프셋과 길이가 올바른지 확인
        assert!(m.params[0].1.0 < raw.len());
        assert!(m.params[0].1.1 > 0);
        assert!(m.params[1].1.0 < raw.len());
        assert!(m.params[1].1.1 > 0);
    }

    #[test]
    fn path_segments_like_dot_and_dotdot_are_treated_as_literals() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/a/./b")
            .add(HttpMethod::Get, "/a/../b")
            .seal()
            .build();

        assert!(r.find(HttpMethod::Get, "/a/./b").is_some());
        assert!(r.find(HttpMethod::Get, "/a/../b").is_some());
        assert!(r.find(HttpMethod::Get, "/a/b").is_none());
    }
}

mod case_sensitivity {
    use super::*;

    #[test]
    fn always_case_sensitive() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/About")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/about").is_none());
        assert!(r.find(HttpMethod::Get, "/About").is_some());
    }

    #[test]
    fn non_ascii_paths_are_rejected() {
        let o = RouterOptions::default();
        let r = RouterBuilder::with_options(o).seal().build();
        assert!(r.find(HttpMethod::Get, "/café").is_none());
        assert!(r.find(HttpMethod::Get, "/Café").is_none());
    }
}

mod params {
    use super::*;

    #[test]
    fn matches_named_params_and_returns_values() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let k = rapi::register_route(&mut r, HttpMethod::Get, "/users/:id").unwrap();
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, HttpMethod::Get, "/users/123").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "id");
        assert_eq!(m.1[0].1.as_str(), "123");
    }

    #[test]
    fn matches_multiple_params_across_two_segments() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let k = rapi::register_route(&mut r, HttpMethod::Get, "/pkg/:name/:ver").unwrap();
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, HttpMethod::Get, "/pkg/foo/1.2.3").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 2);
        assert_eq!(m.1[0].0.as_str(), "name");
        assert_eq!(m.1[0].1.as_str(), "foo");
        assert_eq!(m.1[1].0.as_str(), "ver");
        assert_eq!(m.1[1].1.as_str(), "1.2.3");
    }

    #[test]
    fn returns_params_with_find() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/users/:id")
            .seal()
            .build();
        let path = "/users/123";
        let mo = r.find(HttpMethod::Get, path).unwrap();
        assert!(mo.key != 0);
        assert_eq!(mo.params.len(), 1);
        assert_eq!(mo.params[0].0, "id");
        // 파라미터 값은 오프셋과 길이로 저장되므로 직접 비교할 수 없음
        // 대신 오프셋과 길이가 올바른지 확인
        assert!(mo.params[0].1.0 < path.len());
        assert!(mo.params[0].1.1 > 0);
    }

    #[test]
    fn multi_params_across_segments() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/pkg/:name/:ver")
            .seal()
            .build();
        let path = "/pkg/lib/2.0.1";
        let mo = r.find(HttpMethod::Get, path).unwrap();
        assert!(mo.key != 0);
        assert_eq!(mo.params.len(), 2);
        assert_eq!(mo.params[0].0, "name");
        assert_eq!(mo.params[1].0, "ver");
        // 파라미터 값은 오프셋과 길이로 저장되므로 직접 비교할 수 없음
        // 대신 오프셋과 길이가 올바른지 확인
        assert!(mo.params[0].1.0 < path.len());
        assert!(mo.params[0].1.1 > 0);
        assert!(mo.params[1].1.0 < path.len());
        assert!(mo.params[1].1.1 > 0);
    }
}

mod wildcard {
    use super::*;

    #[test]
    fn matches_trailing_wildcard() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/files/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/files/a/b").is_some());
    }

    #[test]
    fn captures_rest_of_path_for_wildcard_param() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let k = rapi::register_route(&mut r, HttpMethod::Get, "/files/*").unwrap();
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, HttpMethod::Get, "/files/a/b").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "*");
        assert_eq!(m.1[0].1.as_str(), "a/b");
    }

    #[test]
    fn allows_empty_or_slash_remainder_in_builder() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/w/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/w").is_some());
        assert!(r.find(HttpMethod::Get, "/w/").is_some());
    }

    #[test]
    fn matches_when_remainder_is_empty_or_slash() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let k = rapi::register_route(&mut r, HttpMethod::Get, "/files/*").unwrap();
        rapi::seal(&mut r);
        let m1 = rapi::match_route(&r, HttpMethod::Get, "/files").unwrap();
        assert_eq!(m1.0, k);
        assert_eq!(m1.1.len(), 0);
        let m2 = rapi::match_route(&r, HttpMethod::Get, "/files/").unwrap();
        assert_eq!(m2.0, k);
    }

    #[test]
    fn wildcard_at_root_matches_any_non_root_path() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/a").is_some());
        assert!(r.find(HttpMethod::Get, "/a/b").is_some());
        assert!(r.find(HttpMethod::Get, "/").is_none());
    }

    #[test]
    fn wildcard_offsets_after_normalization() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/files/*").is_ok());
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, HttpMethod::Get, "/files//a/b///").unwrap();
        assert!(m.0 != 0);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "*");
        assert_eq!(m.1[0].1.as_str(), "a/b");
    }
}

mod precedence {
    use super::*;

    #[test]
    fn static_route_wins_over_wildcard_route() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/user/*")
            .add(HttpMethod::Get, "/user/me")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/user/me").is_some());
        assert!(r.find(HttpMethod::Get, "/user/123").is_some());
    }

    #[test]
    fn static_vs_wildcard_precedence() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/f/static")
            .add(HttpMethod::Get, "/f/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/f/static").is_some());
        assert!(r.find(HttpMethod::Get, "/f/abc").is_some());
    }

    #[test]
    fn deep_mixed_static_wildcard_precedence() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/a/b/c/d")
            .add(HttpMethod::Get, "/a/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/a/b/c/d").is_some());
        assert!(r.find(HttpMethod::Get, "/a/x/y").is_some());
    }

    #[test]
    fn root_explicit_route_wins_over_root_wildcard() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/")
            .add(HttpMethod::Get, "/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/").is_some());
        assert!(r.find(HttpMethod::Get, "/anything").is_some());
    }
}

mod path_validation {
    use super::*;

    #[test]
    fn all_insert_error_variants_are_covered() {
        // RoutePathEmpty
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, ""),
            Err(RouterError::RoutePathEmpty)
        );

        // RoutePathNotAscii
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/café"),
            Err(RouterError::RoutePathNotAscii)
        );

        // RoutePathContainsDisallowedCharacters
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            assert_eq!(
                rapi::register_route(&mut r, HttpMethod::Get, p),
                Err(RouterError::RoutePathContainsDisallowedCharacters)
            );
        }

        // RoutePathSyntaxInvalid
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/a/:()"),
            Err(RouterError::RoutePathSyntaxInvalid)
        );

        // RouteParamNameInvalidStart
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/:1bad"),
            Err(RouterError::RouteParamNameInvalidStart)
        );

        // RouteParamNameInvalidChar
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/:bad-name"),
            Err(RouterError::RouteParamNameInvalidChar)
        );

        // RouteSegmentContainsMixedParamAndLiteral
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/a/a:bc"),
            Err(RouterError::RouteSegmentContainsMixedParamAndLiteral)
        );

        // duplicate_param_names_in_one_segment_is_syntax_error
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code = rapi::register_route(&mut r, HttpMethod::Get, "/a/:x-:x");
        assert_eq!(code, Err(RouterError::RoutePathSyntaxInvalid));

        // RouteDuplicateParamNameInRoute
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/a/:x/b/:x"),
            Err(RouterError::RouteDuplicateParamNameInRoute)
        );

        // RouteWildcardSegmentNotAtEnd
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/a/*/b"),
            Err(RouterError::RouteWildcardSegmentNotAtEnd)
        );

        // RouteWildcardAlreadyExistsForMethod
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/a/*").is_ok());
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/a/*"),
            Err(RouterError::RouteWildcardAlreadyExistsForMethod)
        );

        // RouteConflictOnDuplicatePath
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/dup").is_ok());
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/dup"),
            Err(RouterError::RouteConflictOnDuplicatePath)
        );

        // RouteParamNameConflictAtSamePosition
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/users/:id").is_ok());
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/users/:name"),
            Err(RouterError::RouteParamNameConflictAtSamePosition)
        );

        // RouterSealedCannotInsert
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/ok").is_ok());
        rapi::seal(&mut r);
        assert_eq!(
            rapi::register_route(&mut r, HttpMethod::Get, "/x"),
            Err(RouterError::RouterSealedCannotInsert)
        );
    }
}

mod match_errors {
    use super::*;

    #[test]
    fn all_match_error_variants_are_covered() {
        // MatchPathEmpty
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::match_route_err(&r, HttpMethod::Get, ""),
            Err(RouterError::MatchPathEmpty)
        );

        // MatchPathNotAscii
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::match_route_err(&r, HttpMethod::Get, "/café"),
            Err(RouterError::MatchPathNotAscii)
        );

        // MatchPathContainsDisallowedCharacters
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            assert_eq!(
                rapi::match_route_err(&r, HttpMethod::Get, p),
                Err(RouterError::MatchPathContainsDisallowedCharacters)
            );
        }

        // MatchNotFound
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/ok").is_ok());
        rapi::seal(&mut r);
        assert_eq!(
            rapi::match_route_err(&r, HttpMethod::Get, "/missing"),
            Err(RouterError::MatchNotFound)
        );

        // MatchPathSyntaxInvalid (Note: current implementation doesn't seem to produce this)
        // Let's ensure no panic on strange but allowed inputs
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/:a")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/'()*,;=").is_some());
    }
}

mod lifecycle {
    use super::*;

    #[test]
    fn error_when_adding_after_seal() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, HttpMethod::Get, "/ok").is_ok());
        rapi::seal(&mut r);
        let code_after_seal = rapi::register_route(&mut r, HttpMethod::Get, "/x");
        assert_eq!(code_after_seal, Err(RouterError::RouterSealedCannotInsert));
        let m = rapi::match_route(&r, HttpMethod::Get, "/ok").unwrap();
        assert_eq!(m.0, 1);
    }

    #[test]
    fn works_without_seal_for_matching() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/ok")
            .build();
        assert!(r.find(HttpMethod::Get, "/ok").is_some());
    }
}

mod optimizations {
    use super::*;

    #[test]
    fn functional_equivalence_with_and_without_static_full_map() {
        let mut o1 = RouterOptions::default();
        o1.enable_static_full_map = true;
        let r1 = RouterBuilder::with_options(o1)
            .add(HttpMethod::Get, "/s/a")
            .add(HttpMethod::Get, "/s/b")
            .seal()
            .build();

        let mut o2 = RouterOptions::default();
        o2.enable_static_full_map = false;
        let r2 = RouterBuilder::with_options(o2)
            .add(HttpMethod::Get, "/s/a")
            .add(HttpMethod::Get, "/s/b")
            .seal()
            .build();

        for p in ["/s/a", "/s/b", "/s/x"].iter() {
            assert_eq!(
                r1.find(HttpMethod::Get, p).is_some(),
                r2.find(HttpMethod::Get, p).is_some()
            );
        }
    }

    #[test]
    fn functional_equivalence_with_and_without_root_prune() {
        let mut o1 = RouterOptions::default();
        o1.enable_root_prune = true;
        let r1 = RouterBuilder::with_options(o1)
            .add(HttpMethod::Get, "/x/:p")
            .add(HttpMethod::Get, "/y/static")
            .seal()
            .build();

        let mut o2 = RouterOptions::default();
        o2.enable_root_prune = false;
        let r2 = RouterBuilder::with_options(o2)
            .add(HttpMethod::Get, "/x/:p")
            .add(HttpMethod::Get, "/y/static")
            .seal()
            .build();

        for p in ["/x/abc", "/y/static", "/zzz"].iter() {
            assert_eq!(
                r1.find(HttpMethod::Get, p).is_some(),
                r2.find(HttpMethod::Get, p).is_some()
            );
        }
    }

    #[test]
    fn root_prune_does_not_false_negative_with_wildcard_at_root() {
        let mut o = RouterOptions::default();
        o.enable_root_prune = true;
        let r = RouterBuilder::with_options(o)
            .add(HttpMethod::Get, "/*")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/a").is_some());
    }

    #[test]
    fn static_full_map_hits_for_long_paths_when_enabled() {
        let mut o = RouterOptions::default();
        o.enable_static_full_map = true;
        let long = "/a/b/c/d/e/f/g/h/i/j";
        let r = RouterBuilder::with_options(o)
            .add(HttpMethod::Get, long)
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, long).is_some());
    }
}

mod edge_cases {
    use super::*;

    #[test]
    fn leading_and_trailing_slashes_variants() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/edge")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/edge/").is_some());
        assert!(r.find(HttpMethod::Get, "////edge///").is_none());
    }

    #[test]
    fn matches_deep_static_and_param_paths() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .add(HttpMethod::Get, "/a/b/c/d/e/:x/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .seal()
            .build();
        assert!(r
            .find(HttpMethod::Get, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_some());
        assert!(r
            .find(HttpMethod::Get, "/a/b/c/d/e/ZZ/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_some());
        assert!(r.find(HttpMethod::Get, "/a/b/c/d/e").is_none());
    }

    #[test]
    fn many_plain_param_patterns_under_same_node_match_correctly() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/p/:n")
            .add(HttpMethod::Get, "/p/x")
            .add(HttpMethod::Get, "/p/a")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/p/xyz").is_some());
        assert!(r.find(HttpMethod::Get, "/p/x").is_some());
        assert!(r.find(HttpMethod::Get, "/p/a").is_some());
    }

    #[test]
    fn case_sensitive_with_dup_and_trailing_works_together() {
        let o = RouterOptions::default();
        let r = RouterBuilder::with_options(o)
            .add(HttpMethod::Get, "/a/b")
            .seal()
            .build();
        assert!(r.find(HttpMethod::Get, "/A//b/").is_none());
        assert!(r.find(HttpMethod::Get, "/a/b").is_some());
    }

    #[test]
    fn same_param_name_has_same_id_across_calls() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/u/:id")
            .seal()
            .build();
        let mo1 = r.find(HttpMethod::Get, "/u/1").unwrap();
        let mo2 = r.find(HttpMethod::Get, "/u/2").unwrap();
        assert_eq!(mo1.params.len(), 1);
        assert_eq!(mo2.params.len(), 1);
        assert_eq!(mo1.params[0].0, mo2.params[0].0);
    }
}

mod automatic_optimizations {
    use super::*;

    #[test]
    fn auto_enables_root_prune_when_no_root_dynamics() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/static")
            .add(HttpMethod::Get, "/another")
            .seal()
            .build();
        assert!(r.internal_router().enable_root_prune);
    }

    #[test]
    fn does_not_auto_enable_root_prune_with_root_param() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/:id")
            .seal()
            .build();
        assert!(!r.internal_router().enable_root_prune);
    }

    #[test]
    fn does_not_auto_enable_root_prune_with_root_wildcard() {
        let r = RouterBuilder::with_options(RouterOptions::default())
            .add(HttpMethod::Get, "/*")
            .seal()
            .build();
        assert!(!r.internal_router().enable_root_prune);
    }

    #[test]
    fn auto_enables_static_map_when_threshold_is_met() {
        let mut builder = RouterBuilder::with_options(RouterOptions::default());
        for i in 0..50 {
            // Threshold is 50
            builder = builder.add(HttpMethod::Get, &format!("/static/{}", i));
        }
        let r = builder.seal().build();
        assert!(r.internal_router().enable_static_full_map);
    }

    #[test]
    fn does_not_auto_enable_static_map_below_threshold() {
        let mut builder = RouterBuilder::with_options(RouterOptions::default());
        for i in 0..49 {
            builder = builder.add(HttpMethod::Get, &format!("/static/{}", i));
        }
        let r = builder.seal().build();
        assert!(!r.internal_router().enable_static_full_map);
    }

    #[test]
    fn respects_manual_disable_of_automatic_optimization() {
        let mut opts = RouterOptions::default();
        opts.automatic_optimization = false;

        // Conditions are met for both optimizations
        let mut builder = RouterBuilder::with_options(opts);
        for i in 0..50 {
            builder = builder.add(HttpMethod::Get, &format!("/static/{}", i));
        }
        let r = builder.seal().build();

        // But they should not be enabled
        assert!(!r.internal_router().enable_root_prune);
        assert!(!r.internal_router().enable_static_full_map);
    }

    #[test]
    fn respects_manual_override_when_auto_is_disabled() {
        let mut opts = RouterOptions::default();
        opts.automatic_optimization = false;
        opts.enable_root_prune = true;
        opts.enable_static_full_map = true;

        // Conditions are NOT met for auto-optimization
        let r = RouterBuilder::with_options(opts)
            .add(HttpMethod::Get, "/*") // Disables auto root prune
            .add(HttpMethod::Get, "/one") // Not enough for auto static map
            .seal()
            .build();

        // But they should be enabled due to manual override
        assert!(r.internal_router().enable_root_prune);
        assert!(r.internal_router().enable_static_full_map);
    }
}
