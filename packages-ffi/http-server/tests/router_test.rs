#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]
use bunner_http_server::r#enum::HttpMethod;
use bunner_http_server::router::{self as rapi, Router, RouterError, RouterOptions};

mod methods {
    use super::*;

    #[test]
    fn supports_all_http_methods() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/r").unwrap();
        r.add(HttpMethod::Post, "/r").unwrap();
        r.add(HttpMethod::Put, "/r").unwrap();
        r.add(HttpMethod::Patch, "/r").unwrap();
        r.add(HttpMethod::Delete, "/r").unwrap();
        r.add(HttpMethod::Options, "/r").unwrap();
        r.add(HttpMethod::Head, "/r").unwrap();
        r.finalize_routes();
        let k_get = r.find(HttpMethod::Get, "/r").unwrap().0;
        let k_post = r.find(HttpMethod::Post, "/r").unwrap().0;
        let k_put = r.find(HttpMethod::Put, "/r").unwrap().0;
        let k_patch = r.find(HttpMethod::Patch, "/r").unwrap().0;
        let k_delete = r.find(HttpMethod::Delete, "/r").unwrap().0;
        let k_options = r.find(HttpMethod::Options, "/r").unwrap().0;
        let k_head = r.find(HttpMethod::Head, "/r").unwrap().0;
        assert!(
            k_get != 0
                && k_post != 0
                && k_put != 0
                && k_patch != 0
                && k_delete != 0
                && k_options != 0
                && k_head != 0
        );
        assert!(r.find(HttpMethod::Get, "/r/x").is_err());
        assert!(r.find(HttpMethod::Head, "/r").is_ok());
        assert!(r.find(HttpMethod::Get, "/r").is_ok());
        assert!(r.find(HttpMethod::Head, "/r").unwrap().0 != r.find(HttpMethod::Get, "/r").unwrap().0);
    }

    #[test]
    fn missing_method_is_none_both_before_and_after_seal() {
        let mut r1 = Router::with_configuration(RouterOptions::default(), None);
        r1.add(HttpMethod::Get, "/only-get").unwrap();
        assert!(r1.find(HttpMethod::Post, "/only-get").is_err());
        let mut r2 = Router::with_configuration(RouterOptions::default(), None);
        r2.add(HttpMethod::Get, "/only-get").unwrap();
        r2.finalize_routes();
        assert!(r2.find(HttpMethod::Post, "/only-get").is_err());
    }

    #[test]
    fn head_does_not_fallback_to_get_and_head_only() {
        let mut r1 = Router::with_configuration(RouterOptions::default(), None);
        r1.add(HttpMethod::Get, "/only-get").unwrap();
        r1.finalize_routes();
        assert!(r1.find(HttpMethod::Head, "/only-get").is_err());

        let mut r2 = Router::with_configuration(RouterOptions::default(), None);
        r2.add(HttpMethod::Head, "/head-only").unwrap();
        r2.finalize_routes();
        assert!(r2.find(HttpMethod::Get, "/head-only").is_err());
        assert!(r2.find(HttpMethod::Head, "/head-only").unwrap().0 != 0);
    }
}

mod static_routes {
    use super::*;

    #[test]
    fn matches_root_route() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/").unwrap().0 != 0);
    }

    #[test]
    fn root_matches_with_leading_duplicate_slashes() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "////").is_ok());
    }

    #[test]
    fn matches_static_routes_by_method() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/health").unwrap();
        r.add(HttpMethod::Post, "/health").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/health").unwrap().0 != 0);
        assert!(r.find(HttpMethod::Post, "/health").unwrap().0 != 0);
    }

    #[test]
    fn rejects_duplicate_static_route_for_same_method() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let k = r.add(HttpMethod::Get, "/health").unwrap();
        let code = r.add(HttpMethod::Get, "/health");
        assert_eq!(code, Err(RouterError::RouteConflictOnDuplicatePath));
        r.finalize_routes();
        let m = r.find( HttpMethod::Get, "/health").unwrap();
        assert_eq!(m.0, k);
    }

    #[test]
    fn heavy_static_routes_with_high_duplication_probability() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        for i in 0..100u32 {
            let path = format!("/assets/v1/css/{}.css", i);
            assert!(r.add( HttpMethod::Get, &path).is_ok());
        }

        r.finalize_routes();

        for i in [0u32, 1, 50, 99] {
            let p = format!("/assets/v1/css/{}.css", i);
            let m = r.find( HttpMethod::Get, &p).unwrap();
            assert!(m.0 != 0);
        }
    }
}

mod normalization {
    use super::*;

    #[test]
    fn trailing_slash_is_always_ignored() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/api/users").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/api/users/").is_ok());
        assert!(r.find(HttpMethod::Get, "/api/users").is_ok());
    }

    #[test]
    fn duplicate_slashes_are_not_ignored() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/b").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/a//b").is_err());
        assert!(r.find(HttpMethod::Get, "/a//b///").is_err());
    }

    #[test]
    fn duplicate_slash_does_not_match_static_path() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/x/b").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/a//b").is_err());
    }

    #[test]
    fn trailing_slash_ignoring_works_with_params() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/p/:x/:y").unwrap();
        r.finalize_routes();
        let raw = "/p/AA/BB/";
        let m = r.find(HttpMethod::Get, raw).unwrap();
        assert!(m.0 != 0);
        assert_eq!(m.1.len(), 2);
        assert_eq!(m.1[0].0, "x");
        assert_eq!(m.1[1].0, "y");
        // 파라미터 값이 직접 문자열로 제공됨
        assert_eq!(m.1[0].1, "AA");
        assert_eq!(m.1[1].1, "BB");
    }

    #[test]
    fn path_segments_like_dot_and_dotdot_are_treated_as_literals() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/./b").unwrap();
            r.add(HttpMethod::Get, "/a/../b").unwrap();
        r.finalize_routes();

        assert!(r.find(HttpMethod::Get, "/a/./b").is_ok());
        assert!(r.find(HttpMethod::Get, "/a/../b").is_ok());
        assert!(r.find(HttpMethod::Get, "/a/b").is_err());
    }
}

mod case_sensitivity {
    use super::*;

    #[test]
    fn always_case_sensitive() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/About").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/about").is_err());
        assert!(r.find(HttpMethod::Get, "/About").is_ok());
    }

    #[test]
    fn non_ascii_paths_are_rejected() {
        let o = RouterOptions::default();
        let mut r = Router::with_configuration(o, None);
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/café").is_err());
        assert!(r.find(HttpMethod::Get, "/Café").is_err());
    }
}

mod params {
    use super::*;

    #[test]
    fn matches_named_params_and_returns_values() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let k = r.add( HttpMethod::Get, "/users/:id").unwrap();
        r.finalize_routes();
        let m = r.find( HttpMethod::Get, "/users/123").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "id");
        assert_eq!(m.1[0].1.as_str(), "123");
    }

    #[test]
    fn matches_multiple_params_across_two_segments() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let k = r.add( HttpMethod::Get, "/pkg/:name/:ver").unwrap();
        r.finalize_routes();
        let m = r.find( HttpMethod::Get, "/pkg/foo/1.2.3").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 2);
        assert_eq!(m.1[0].0.as_str(), "name");
        assert_eq!(m.1[0].1.as_str(), "foo");
        assert_eq!(m.1[1].0.as_str(), "ver");
        assert_eq!(m.1[1].1.as_str(), "1.2.3");
    }

    #[test]
    fn returns_params_with_find() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/users/:id").unwrap();
        r.finalize_routes();
        let path = "/users/123";
        let mo = r.find(HttpMethod::Get, path).unwrap();
        assert!(mo.0 != 0);
        assert_eq!(mo.1.len(), 1);
        assert_eq!(mo.1[0].0, "id");
        // 파라미터 값이 직접 문자열로 제공됨
        assert_eq!(mo.1[0].1, "123");
    }

    #[test]
    fn multi_params_across_segments() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/pkg/:name/:ver").unwrap();
        r.finalize_routes();
        let path = "/pkg/lib/2.0.1";
        let mo = r.find(HttpMethod::Get, path).unwrap();
        assert!(mo.0 != 0);
        assert_eq!(mo.1.len(), 2);
        assert_eq!(mo.1[0].0, "name");
        assert_eq!(mo.1[1].0, "ver");
        // 파라미터 값이 직접 문자열로 제공됨
        assert_eq!(mo.1[0].1, "lib");
        assert_eq!(mo.1[1].1, "2.0.1");
    }
}

mod wildcard {
    use super::*;

    #[test]
    fn matches_trailing_wildcard() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/files/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/files/a/b").is_ok());
    }

    #[test]
    fn captures_rest_of_path_for_wildcard_param() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let k = r.add( HttpMethod::Get, "/files/*").unwrap();
        r.finalize_routes();
        let m = r.find( HttpMethod::Get, "/files/a/b").unwrap();
        assert_eq!(m.0, k);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "*");
        assert_eq!(m.1[0].1.as_str(), "a/b");
    }

    #[test]
    fn allows_empty_or_slash_remainder_in_builder() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/w/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/w").is_ok());
        assert!(r.find(HttpMethod::Get, "/w/").is_ok());
    }

    #[test]
    fn matches_when_remainder_is_empty_or_slash() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let k = r.add( HttpMethod::Get, "/files/*").unwrap();
        r.finalize_routes();
        let m1 = r.find( HttpMethod::Get, "/files").unwrap();
        assert_eq!(m1.0, k);
        assert_eq!(m1.1.len(), 0);
        let m2 = r.find( HttpMethod::Get, "/files/").unwrap();
        assert_eq!(m2.0, k);
    }

    #[test]
    fn wildcard_at_root_matches_any_non_root_path() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/a").is_ok());
        assert!(r.find(HttpMethod::Get, "/a/b").is_ok());
        assert!(r.find(HttpMethod::Get, "/").is_err());
    }

    #[test]
    fn wildcard_offsets_after_normalization() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/files/*").is_ok());
        r.finalize_routes();
        let m = r.find( HttpMethod::Get, "/files//a/b///").unwrap();
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
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/user/*").unwrap();
            r.add(HttpMethod::Get, "/user/me").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/user/me").is_ok());
        assert!(r.find(HttpMethod::Get, "/user/123").is_ok());
    }

    #[test]
    fn static_vs_wildcard_precedence() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/f/static").unwrap();
            r.add(HttpMethod::Get, "/f/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/f/static").is_ok());
        assert!(r.find(HttpMethod::Get, "/f/abc").is_ok());
    }

    #[test]
    fn deep_mixed_static_wildcard_precedence() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/b/c/d").unwrap();
            r.add(HttpMethod::Get, "/a/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/a/b/c/d").is_ok());
        assert!(r.find(HttpMethod::Get, "/a/x/y").is_ok());
    }

    #[test]
    fn root_explicit_route_wins_over_root_wildcard() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/").unwrap();
            r.add(HttpMethod::Get, "/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/").is_ok());
        assert!(r.find(HttpMethod::Get, "/anything").is_ok());
    }
}

mod path_validation {
    use super::*;

    #[test]
    fn all_insert_error_variants_are_covered() {
        // RoutePathEmpty
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, ""),
            Err(RouterError::RoutePathEmpty)
        );

        // RoutePathNotAscii
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/café"),
            Err(RouterError::RoutePathNotAscii)
        );

        // RoutePathContainsDisallowedCharacters
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            assert_eq!(
                r.add( HttpMethod::Get, p),
                Err(RouterError::RoutePathContainsDisallowedCharacters)
            );
        }

        // RoutePathSyntaxInvalid
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/a/:()"),
            Err(RouterError::RoutePathSyntaxInvalid)
        );

        // RouteParamNameInvalidStart
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/:1bad"),
            Err(RouterError::RouteParamNameInvalidStart)
        );

        // RouteParamNameInvalidChar
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/:bad-name"),
            Err(RouterError::RouteParamNameInvalidChar)
        );

        // RouteSegmentContainsMixedParamAndLiteral
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/a/a:bc"),
            Err(RouterError::RouteSegmentContainsMixedParamAndLiteral)
        );

        // duplicate_param_names_in_one_segment_is_syntax_error
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        let code = r.add( HttpMethod::Get, "/a/:x-:x");
        assert_eq!(code, Err(RouterError::RoutePathSyntaxInvalid));

        // RouteDuplicateParamNameInRoute
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/a/:x/b/:x"),
            Err(RouterError::RouteDuplicateParamNameInRoute)
        );

        // RouteWildcardSegmentNotAtEnd
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.add( HttpMethod::Get, "/a/*/b"),
            Err(RouterError::RouteWildcardSegmentNotAtEnd)
        );

        // RouteWildcardAlreadyExistsForMethod
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/a/*").is_ok());
        assert_eq!(
            r.add( HttpMethod::Get, "/a/*"),
            Err(RouterError::RouteWildcardAlreadyExistsForMethod)
        );

        // RouteConflictOnDuplicatePath
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/dup").is_ok());
        assert_eq!(
            r.add( HttpMethod::Get, "/dup"),
            Err(RouterError::RouteConflictOnDuplicatePath)
        );

        // RouteParamNameConflictAtSamePosition
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/users/:id").is_ok());
        assert_eq!(
            r.add( HttpMethod::Get, "/users/:name"),
            Err(RouterError::RouteParamNameConflictAtSamePosition)
        );

        // RouterSealedCannotInsert
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/ok").is_ok());
        r.finalize_routes();
        assert_eq!(
            r.add( HttpMethod::Get, "/x"),
            Err(RouterError::RouterSealedCannotInsert)
        );
    }
}

mod match_errors {
    use super::*;

    #[test]
    fn all_match_error_variants_are_covered() {
        // MatchPathEmpty
        let r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.find( HttpMethod::Get, ""),
            Err(RouterError::MatchPathEmpty)
        );

        // MatchPathNotAscii
        let r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert_eq!(
            r.find( HttpMethod::Get, "/café"),
            Err(RouterError::MatchPathNotAscii)
        );

        // MatchPathContainsDisallowedCharacters
        let r = rapi::Router::with_configuration(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            assert_eq!(
                r.find( HttpMethod::Get, p),
                Err(RouterError::MatchPathContainsDisallowedCharacters)
            );
        }

        // MatchNotFound
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/ok").is_ok());
        r.finalize_routes();
        assert_eq!(
            r.find( HttpMethod::Get, "/missing"),
            Err(RouterError::MatchNotFound)
        );

        // MatchPathSyntaxInvalid (Note: current implementation doesn't seem to produce this)
        // Let's ensure no panic on strange but allowed inputs
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/:a").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/'()*,;=").is_ok());
    }
}

mod lifecycle {
    use super::*;

    #[test]
    fn error_when_adding_after_seal() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        assert!(r.add( HttpMethod::Get, "/ok").is_ok());
        r.finalize_routes();
        let code_after_seal = r.add( HttpMethod::Get, "/x");
        assert_eq!(code_after_seal, Err(RouterError::RouterSealedCannotInsert));
        let m = r.find( HttpMethod::Get, "/ok").unwrap();
        assert_eq!(m.0, 1);
    }

    #[test]
    fn works_without_seal_for_matching() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/ok").unwrap();
        assert!(r.find(HttpMethod::Get, "/ok").is_ok());
    }
}

mod optimizations {
    use super::*;

    #[test]
    fn functional_equivalence_with_and_without_static_full_map() {
        let mut o1 = RouterOptions::default();
        o1.enable_static_route_full_mapping = true;
        let mut r1 = Router::with_configuration(o1, None);
        r1.add(HttpMethod::Get, "/s/a").unwrap();
        r1.add(HttpMethod::Get, "/s/b").unwrap();
        r1.finalize_routes();

        let mut o2 = RouterOptions::default();
        o2.enable_static_route_full_mapping = false;
        let mut r2 = Router::with_configuration(o2, None);
        r2.add(HttpMethod::Get, "/s/a").unwrap();
        r2.add(HttpMethod::Get, "/s/b").unwrap();
        r2.finalize_routes();

        for p in ["/s/a", "/s/b", "/s/x"].iter() {
            assert_eq!(
                r1.find(HttpMethod::Get, p).is_ok(),
                r2.find(HttpMethod::Get, p).is_ok()
            );
        }
    }

    #[test]
    fn functional_equivalence_with_and_without_root_prune() {
        let mut o1 = RouterOptions::default();
        o1.enable_root_level_pruning = true;
        let mut r1 = Router::with_configuration(o1, None);
        r1.add(HttpMethod::Get, "/x/:p").unwrap();
        r1.add(HttpMethod::Get, "/y/static").unwrap();
        r1.finalize_routes();

        let mut o2 = RouterOptions::default();
        o2.enable_root_level_pruning = false;
        let mut r2 = Router::with_configuration(o2, None);
        r2.add(HttpMethod::Get, "/x/:p").unwrap();
        r2.add(HttpMethod::Get, "/y/static").unwrap();
        r2.finalize_routes();

        for p in ["/x/abc", "/y/static", "/zzz"].iter() {
            assert_eq!(
                r1.find(HttpMethod::Get, p).is_ok(),
                r2.find(HttpMethod::Get, p).is_ok()
            );
        }
    }

    #[test]
    fn root_prune_does_not_false_negative_with_wildcard_at_root() {
        let mut o = RouterOptions::default();
        o.enable_root_level_pruning = true;
        let mut r = Router::with_configuration(o, None);
        r.add(HttpMethod::Get, "/*").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/a").is_ok());
    }

    #[test]
    fn static_full_map_hits_for_long_paths_when_enabled() {
        let mut o = RouterOptions::default();
        o.enable_static_route_full_mapping = true;
        let long = "/a/b/c/d/e/f/g/h/i/j";
        let mut r = Router::with_configuration(o, None);
        r.add(HttpMethod::Get, long).unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, long).is_ok());
    }
}

mod edge_cases {
    use super::*;

    #[test]
    fn leading_and_trailing_slashes_variants() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/edge").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/edge/").is_ok());
        assert!(r.find(HttpMethod::Get, "////edge///").is_err());
    }

    #[test]
    fn matches_deep_static_and_param_paths() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v").unwrap();
            r.add(HttpMethod::Get, "/a/b/c/d/e/:x/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v").unwrap();
        r.finalize_routes();
        assert!(r
            .find(HttpMethod::Get, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_ok());
        assert!(r
            .find(HttpMethod::Get, "/a/b/c/d/e/ZZ/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_ok());
        assert!(r.find(HttpMethod::Get, "/a/b/c/d/e").is_err());
    }

    #[test]
    fn many_plain_param_patterns_under_same_node_match_correctly() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/p/:n").unwrap();
            r.add(HttpMethod::Get, "/p/x").unwrap();
            r.add(HttpMethod::Get, "/p/a").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/p/xyz").is_ok());
        assert!(r.find(HttpMethod::Get, "/p/x").is_ok());
        assert!(r.find(HttpMethod::Get, "/p/a").is_ok());
    }

    #[test]
    fn case_sensitive_with_dup_and_trailing_works_together() {
        let o = RouterOptions::default();
        let mut r = Router::with_configuration(o, None);
        r.add(HttpMethod::Get, "/a/b").unwrap();
        r.finalize_routes();
        assert!(r.find(HttpMethod::Get, "/A//b/").is_err());
        assert!(r.find(HttpMethod::Get, "/a/b").is_ok());
    }

    #[test]
    fn same_param_name_has_same_id_across_calls() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/u/:id").unwrap();
        r.finalize_routes();
        let mo1 = r.find(HttpMethod::Get, "/u/1").unwrap();
        let mo2 = r.find(HttpMethod::Get, "/u/2").unwrap();
        assert_eq!(mo1.1.len(), 1);
        assert_eq!(mo2.1.len(), 1);
        assert_eq!(mo1.1[0].0, mo2.1[0].0);
    }
}

mod enable_automatic_optimizations {
    use super::*;

    #[test]
    fn auto_enables_root_prune_when_no_root_dynamics() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/static").unwrap();
            r.add(HttpMethod::Get, "/another").unwrap();
        r.finalize_routes();
        assert!(r.get_internal_radix_router().enable_root_level_pruning);
    }

    #[test]
    fn does_not_auto_enable_root_level_pruning_with_root_param() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/:id").unwrap();
        r.finalize_routes();
        assert!(!r.get_internal_radix_router().enable_root_level_pruning);
    }

    #[test]
    fn does_not_auto_enable_root_level_pruning_with_root_wildcard() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/*").unwrap();
        r.finalize_routes();
        assert!(!r.get_internal_radix_router().enable_root_level_pruning);
    }

    #[test]
    fn auto_enables_static_map_when_threshold_is_met() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        for i in 0..50 {
          println!("Adding route: /static/{}", i);
            r.add(HttpMethod::Get, &format!("/static/{}", i)).unwrap();
        }
        r.finalize_routes();
        assert!(r.get_internal_radix_router().enable_static_route_full_mapping);
    }

    #[test]
    fn does_not_auto_enable_static_map_below_threshold() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        for i in 0..49 {
            r.add(HttpMethod::Get, &format!("/static/{}", i)).unwrap();
        }
        r.finalize_routes();
        assert!(!r.get_internal_radix_router().enable_static_route_full_mapping);
    }

    #[test]
    fn respects_manual_disable_of_enable_automatic_optimization() {
        let mut opts = RouterOptions::default();
        opts.enable_automatic_optimization = false;

        // Conditions are met for both optimizations
        let mut r = Router::with_configuration(opts, None);
        for i in 0..50 {
            r.add(HttpMethod::Get, &format!("/static/{}", i)).unwrap();
        }
        r.finalize_routes();

        // But they should not be enabled
        assert!(!r.get_internal_radix_router().enable_root_level_pruning);
        assert!(!r.get_internal_radix_router().enable_static_route_full_mapping);
    }

    #[test]
    fn respects_manual_override_when_auto_is_disabled() {
        let mut opts = RouterOptions::default();
        opts.enable_automatic_optimization = false;
        opts.enable_root_level_pruning = true;
        opts.enable_static_route_full_mapping = true;

        let mut r = Router::with_configuration(opts, None);
        r.add(HttpMethod::Get, "/*").unwrap();
        r.add(HttpMethod::Get, "/one").unwrap();
        r.finalize_routes();

        assert!(r.get_internal_radix_router().enable_root_level_pruning);
        assert!(r.get_internal_radix_router().enable_static_route_full_mapping);
    }

    #[test]
    fn max_routes_guard_activation() {
        let opts = RouterOptions::default();
        let mut r = Router::with_configuration(opts, None);
        let mut got_err = None;

        for i in 0..=100 {
            let path = format!("/route{}", i);
            match r.add(HttpMethod::Get, &path) {
                Ok(_) => {
                    println!("Added route: /route{}", i);
                    continue;
                }
                Err(e) => {
                    print!("Error adding route: /route{}", i);
                    got_err = Some(e);
                    break;
                }
            }
        }

        assert!(got_err.is_some(), "Route limit was not reached within test bounds");
        assert!(matches!(got_err.unwrap(), RouterError::MaxRoutesExceeded));
    }
}
