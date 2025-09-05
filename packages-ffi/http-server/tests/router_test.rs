#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]
use bunner_http_server::router::{self as rapi, Method, RouterBuilder, RouterError, RouterOptions};

mod methods {
    use super::*;

    mod basic {
        use super::*;

        #[test]
        fn supports_all_http_methods() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/r")
                .add(Method::POST, "/r")
                .add(Method::PUT, "/r")
                .add(Method::PATCH, "/r")
                .add(Method::DELETE, "/r")
                .add(Method::OPTIONS, "/r")
                .add(Method::HEAD, "/r")
                .seal()
                .build();
            let k_get = h.find(Method::GET, "/r").unwrap().key;
            let k_post = h.find(Method::POST, "/r").unwrap().key;
            let k_put = h.find(Method::PUT, "/r").unwrap().key;
            let k_patch = h.find(Method::PATCH, "/r").unwrap().key;
            let k_delete = h.find(Method::DELETE, "/r").unwrap().key;
            let k_options = h.find(Method::OPTIONS, "/r").unwrap().key;
            let k_head = h.find(Method::HEAD, "/r").unwrap().key;
            assert!(
                k_get != 0
                    && k_post != 0
                    && k_put != 0
                    && k_patch != 0
                    && k_delete != 0
                    && k_options != 0
                    && k_head != 0
            );
            assert!(h.find(Method::GET, "/r/x").is_none());
            assert!(h.find(Method::HEAD, "/r").is_some());
            assert!(h.find(Method::GET, "/r").is_some());
            assert!(
                h.find(Method::HEAD, "/r").unwrap().key != h.find(Method::GET, "/r").unwrap().key
            );
        }
    }

    mod mask_prune {
        use super::*;

        #[test]
        fn missing_method_is_none_both_before_and_after_seal() {
            let h1 = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/only-get")
                .build();
            assert!(h1.find(Method::POST, "/only-get").is_none());
            let h2 = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/only-get")
                .seal()
                .build();
            assert!(h2.find(Method::POST, "/only-get").is_none());
        }
    }

    mod mapping {
        use super::*;

        #[test]
        fn unknown_method_maps_to_get_for_register_and_match() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 999, "/mystery").unwrap();
            rapi::seal(&mut r);
            let m1 = rapi::match_route(&r, 999, "/mystery").unwrap();
            assert_eq!(m1.0, k);
            let m2 = rapi::match_route(&r, 0, "/mystery").unwrap();
            assert_eq!(m2.0, k);
        }
    }

    mod head_only {
        use super::*;

        #[test]
        fn head_does_not_fallback_to_get_and_head_only() {
            let h1 = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/only-get")
                .seal()
                .build();
            assert!(h1.find(Method::HEAD, "/only-get").is_none());

            let h2 = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::HEAD, "/head-only")
                .seal()
                .build();
            assert!(h2.find(Method::GET, "/head-only").is_none());
            assert!(h2.find(Method::HEAD, "/head-only").unwrap().key != 0);
        }
    }
}

mod static_and_root {
    use super::*;

    mod root {
        use super::*;

        #[test]
        fn matches_root_route() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/").unwrap().key != 0);
        }

        #[test]
        fn root_matches_with_leading_duplicate_slashes() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/")
                .seal()
                .build();
            assert!(h.find(Method::GET, "////").is_some());
        }
    }

    mod static_routes {
        use super::*;

        #[test]
        fn matches_static_routes_by_method() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/health")
                .add(Method::POST, "/health")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/health").unwrap().key != 0);
            assert!(h.find(Method::POST, "/health").unwrap().key != 0);
        }

        #[test]
        fn rejects_duplicate_static_route_for_same_method() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 0, "/health").unwrap();
            let code = rapi::register_route_ex(&mut r, 0, "/health");
            assert_eq!(code, RouterError::RouteConflictOnDuplicatePath as u32);
            rapi::seal(&mut r);
            let m = rapi::match_route(&r, 0, "/health").unwrap();
            assert_eq!(m.0, k);
        }

        #[test]
        fn heavy_static_routes_with_high_duplication_probability() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            for i in 0..200u32 {
                let path = format!("/assets/v1/css/{}.css", i);
                assert!(rapi::register_route(&mut r, 0, &path).is_ok());
            }
            rapi::seal(&mut r);
            for i in [0u32, 1, 50, 100, 150, 199] {
                let p = format!("/assets/v1/css/{}.css", i);
                let m = rapi::match_route(&r, 0, &p).unwrap();
                assert!(m.0 != 0);
            }
        }
    }
}

mod normalization {
    use super::*;

    mod trailing_slash {
        use super::*;

        #[test]
        fn trailing_slash_is_always_ignored() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/api/users")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/api/users/").is_some());
            assert!(h.find(Method::GET, "/api/users").is_some());
        }
    }

    mod duplicate_slashes {
        use super::*;

        #[test]
        fn duplicate_slashes_are_not_ignored() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/a/b")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/a//b").is_none());
        }

        #[test]
        fn duplicate_slashes_fail_even_with_trailing_slashes() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/a/b")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/a//b///").is_none());
        }
    }

    mod interactions {
        use super::*;

        #[test]
        fn duplicate_slash_does_not_match_static_path() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/a/x/b")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/a//b").is_none());
        }

        #[test]
        fn offsets_respect_trailing_slash_ignoring_only() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/p/:x/:y")
                .seal()
                .build();
            let raw = "/p/AA/BB/";
            let m = h.find_offsets(Method::GET, raw).unwrap();
            assert!(m.key != 0);
            let norm = "/p/AA/BB";
            assert_eq!(m.params.len(), 2);
            let (_idx1, (o1, l1)) = m.params[0];
            let (_idx2, (o2, l2)) = m.params[1];
            assert_eq!(&norm[o1..o1 + l1], "AA");
            assert_eq!(&norm[o2..o2 + l2], "BB");
        }
    }

    mod negative {
        use super::*;

        #[test]
        fn duplicate_slashes_not_normalized_but_trailing_is() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/x/y")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/x//y").is_none());
            assert!(h.find(Method::GET, "/x/y/").is_some());
        }
    }
}

mod case_sensitivity {
    use super::*;

    #[test]
    fn default_is_case_sensitive() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/About")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/about").is_none());
    }

    #[test]
    fn case_insensitive_when_disabled() {
        let mut o = RouterOptions::default();
        o.case_sensitive = false;
        let h = RouterBuilder::with_options(o)
            .add(Method::GET, "/About")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/about").is_some());
        assert!(h.find(Method::GET, "/ABOUT").is_some());
    }

    #[test]
    fn conflict_on_duplicate_path_with_different_case_when_insensitive() {
        let mut o = RouterOptions::default();
        o.case_sensitive = false;
        let mut r = rapi::Router::with_options(o, None);
        assert!(rapi::register_route(&mut r, 0, "/About").is_ok());
        let code = rapi::register_route_ex(&mut r, 0, "/about");
        assert_eq!(code, RouterError::RouteConflictOnDuplicatePath as u32);
    }

    #[test]
    fn non_ascii_paths_are_rejected() {
        let mut o = RouterOptions::default();
        o.case_sensitive = false;
        let h = RouterBuilder::with_options(o).seal().build();
        assert!(h.find(Method::GET, "/café").is_none());
        assert!(h.find(Method::GET, "/Café").is_none());
    }
}

mod params {
    use super::*;

    mod basic {
        use super::*;

        #[test]
        fn matches_named_params_and_returns_values() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 0, "/users/:id").unwrap();
            rapi::seal(&mut r);
            let m = rapi::match_route(&r, 0, "/users/123").unwrap();
            assert_eq!(m.0, k);
            assert_eq!(m.1.len(), 1);
            assert_eq!(m.1[0].0.as_str(), "id");
            assert_eq!(m.1[0].1.as_str(), "123");
        }

        #[test]
        fn matches_multiple_params_across_two_segments() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 0, "/pkg/:name/:ver").unwrap();
            rapi::seal(&mut r);
            let m = rapi::match_route(&r, 0, "/pkg/foo/1.2.3").unwrap();
            assert_eq!(m.0, k);
            assert_eq!(m.1.len(), 2);
            assert_eq!(m.1[0].0.as_str(), "name");
            assert_eq!(m.1[0].1.as_str(), "foo");
            assert_eq!(m.1[1].0.as_str(), "ver");
            assert_eq!(m.1[1].1.as_str(), "1.2.3");
        }
    }

    mod offsets {
        use super::*;

        #[test]
        fn returns_offsets_with_find_offsets() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/users/:id")
                .seal()
                .build();
            let path = "/users/123";
            let mo = h.find_offsets(Method::GET, path).unwrap();
            assert!(mo.key != 0);
            assert_eq!(mo.params.len(), 1);
            let (_name_id, (off, len)) = mo.params[0];
            assert_eq!(&path[off..off + len], "123");
        }
    }

    mod name_collision {
        use super::*;

        #[test]
        fn duplicate_param_names_in_one_segment_is_syntax_error() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let code = rapi::register_route_ex(&mut r, 0, "/a/:x-:x");
            assert_eq!(code, RouterError::RoutePathSyntaxInvalid as u32);
        }
    }
}

mod precedence {
    use super::*;

    #[test]
    fn static_route_wins_over_wildcard_route() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/user/*")
            .add(Method::GET, "/user/me")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/user/me").is_some());
        assert!(h.find(Method::GET, "/user/123").is_some());
    }

    #[test]
    fn static_vs_wildcard_precedence() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/f/static")
            .add(Method::GET, "/f/*")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/f/static").is_some());
        assert!(h.find(Method::GET, "/f/abc").is_some());
    }

    #[test]
    fn deep_mixed_static_wildcard_precedence() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/a/b/c/d")
            .add(Method::GET, "/a/*")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/a/b/c/d").is_some());
        assert!(h.find(Method::GET, "/a/x/y").is_some());
    }
}

mod wildcard {
    use super::*;

    mod matching {
        use super::*;

        #[test]
        fn matches_trailing_wildcard_and_prefers_static_over_wildcard() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/files/*")
                .add(Method::GET, "/app/static/*")
                .add(Method::GET, "/app/static/index.html")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/files/a/b").is_some());
            assert!(h.find(Method::GET, "/app/static/index.html").is_some());
        }

        #[test]
        fn captures_rest_of_path_for_wildcard_param() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 0, "/files/*").unwrap();
            rapi::seal(&mut r);
            let m = rapi::match_route(&r, 0, "/files/a/b").unwrap();
            assert_eq!(m.0, k);
            assert_eq!(m.1.len(), 1);
            assert_eq!(m.1[0].0.as_str(), "*");
            assert_eq!(m.1[0].1.as_str(), "a/b");
        }

        #[test]
        fn allows_empty_or_slash_remainder_in_builder() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/w/*")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/w").is_some());
            assert!(h.find(Method::GET, "/w/").is_some());
        }

        #[test]
        fn errors_when_wildcard_not_last_segment() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            assert_eq!(
                rapi::register_route_ex(&mut r, 0, "/a/*/b"),
                RouterError::RouteWildcardSegmentNotAtEnd as u32
            );
        }

        #[test]
        fn matches_when_remainder_is_empty_or_slash() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let k = rapi::register_route(&mut r, 0, "/files/*").unwrap();
            rapi::seal(&mut r);
            let m1 = rapi::match_route(&r, 0, "/files").unwrap();
            assert_eq!(m1.0, k);
            assert_eq!(m1.1.len(), 0);
            let m2 = rapi::match_route(&r, 0, "/files/").unwrap();
            assert_eq!(m2.0, k);
        }
    }

    mod errors {
        use super::*;

        #[test]
        fn errors_when_wildcard_not_last_segment() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            let code = rapi::register_route_ex(&mut r, 0, "/x/*/y");
            assert_eq!(code, RouterError::RouteWildcardSegmentNotAtEnd as u32);
        }

        #[test]
        fn rejects_second_wildcard_on_same_node_for_method() {
            let mut r = rapi::Router::with_options(RouterOptions::default(), None);
            assert!(rapi::register_route(&mut r, 0, "/a/*").is_ok());
            let code = rapi::register_route_ex(&mut r, 0, "/a/*");
            assert_eq!(
                code,
                RouterError::RouteWildcardAlreadyExistsForMethod as u32
            );
        }
    }

    mod root {
        use super::*;

        #[test]
        fn wildcard_at_root_matches_any_non_root_path() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/*")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/a").is_some());
            assert!(h.find(Method::GET, "/a/b").is_some());
            assert!(h.find(Method::GET, "/").is_none());
        }

        #[test]
        fn root_explicit_route_wins_over_root_wildcard() {
            let h = RouterBuilder::with_options(RouterOptions::default())
                .add(Method::GET, "/")
                .add(Method::GET, "/*")
                .seal()
                .build();
            assert!(h.find(Method::GET, "/").is_some());
            assert!(h.find(Method::GET, "/anything").is_some());
        }
    }
}

mod path_validation {
    use super::*;

    #[test]
    fn syntax_error_for_empty_path() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code_empty = rapi::register_route_ex(&mut r, 0, "");
        assert_eq!(code_empty, RouterError::RoutePathEmpty as u32);
    }

    #[test]
    fn syntax_error_for_invalid_param_name_or_format() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code = rapi::register_route_ex(&mut r, 0, "/a/:()");
        assert_eq!(code, RouterError::RoutePathSyntaxInvalid as u32);
    }

    #[test]
    fn non_ascii_path_is_syntax_error_on_register() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let ok = rapi::register_route(&mut r, 0, "/café");
        assert!(ok.is_err());
        let code = rapi::register_route_ex(&mut r, 0, "/café");
        assert_eq!(code, RouterError::RoutePathNotAscii as u32);
    }
}

mod insert_errors_exhaustive {
    use super::*;

    #[test]
    fn invalid_param_name_start_is_rejected() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code = rapi::register_route_ex(&mut r, 0, "/:1bad");
        assert_eq!(code, RouterError::RouteParamNameInvalidStart as u32);
    }

    #[test]
    fn invalid_param_name_char_is_rejected() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code = rapi::register_route_ex(&mut r, 0, "/:bad-name");
        assert_eq!(code, RouterError::RouteParamNameInvalidChar as u32);
    }

    #[test]
    fn mixed_param_and_literal_in_segment_is_rejected() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        let code = rapi::register_route_ex(&mut r, 0, "/a/a:bc");
        assert_eq!(
            code,
            RouterError::RouteSegmentContainsMixedParamAndLiteral as u32
        );
    }

    #[test]
    fn disallowed_characters_in_path_are_rejected() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            let code = rapi::register_route_ex(&mut r, 0, p);
            assert_eq!(
                code,
                RouterError::RoutePathContainsDisallowedCharacters as u32
            );
        }
    }
}

mod match_error_semantics {
    use super::*;

    #[test]
    fn empty_path_is_syntax_error_on_match() {
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        let res = rapi::match_route_err(&r, 0, "");
        assert!(res.is_err());
        assert!(matches!(res.err().unwrap(), RouterError::MatchPathEmpty));
    }

    #[test]
    fn non_ascii_path_is_rejected_on_match() {
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        let res = rapi::match_route_err(&r, 0, "/café");
        assert!(matches!(res.err().unwrap(), RouterError::MatchPathNotAscii));
    }

    #[test]
    fn disallowed_characters_are_rejected_on_match() {
        let r = rapi::Router::with_options(RouterOptions::default(), None);
        for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
            let res = rapi::match_route_err(&r, 0, p);
            assert!(matches!(
                res.err().unwrap(),
                RouterError::MatchPathContainsDisallowedCharacters
            ));
        }
    }

    #[test]
    fn not_found_is_reported() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, 0, "/ok").is_ok());
        rapi::seal(&mut r);
        let res = rapi::match_route_err(&r, 0, "/missing");
        assert!(matches!(res.err().unwrap(), RouterError::MatchNotFound));
    }
}

mod lifecycle_sealing {
    use super::*;

    #[test]
    fn error_when_adding_after_seal() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, 0, "/ok").is_ok());
        rapi::seal(&mut r);
        let code_after_seal = rapi::register_route_ex(&mut r, 0, "/x");
        assert_eq!(
            code_after_seal,
            RouterError::RouterSealedCannotInsert as u32
        );
        let m = rapi::match_route(&r, 0, "/ok").unwrap();
        assert_eq!(m.0, 1);
    }
}

mod lookup_optimizations {
    use super::*;

    #[test]
    fn functional_equivalence_with_and_without_static_full_map() {
        let mut o1 = RouterOptions::default();
        o1.enable_static_full_map = true;
        let h1 = RouterBuilder::with_options(o1)
            .add(Method::GET, "/s/a")
            .add(Method::GET, "/s/b")
            .seal()
            .build();

        let mut o2 = RouterOptions::default();
        o2.enable_static_full_map = false;
        let h2 = RouterBuilder::with_options(o2)
            .add(Method::GET, "/s/a")
            .add(Method::GET, "/s/b")
            .seal()
            .build();

        for p in ["/s/a", "/s/b", "/s/x"].iter() {
            assert_eq!(
                h1.find(Method::GET, p).is_some(),
                h2.find(Method::GET, p).is_some()
            );
        }
    }

    #[test]
    fn functional_equivalence_with_and_without_root_prune() {
        let mut o1 = RouterOptions::default();
        o1.enable_root_prune = true;
        let h1 = RouterBuilder::with_options(o1)
            .add(Method::GET, "/x/:p")
            .add(Method::GET, "/y/static")
            .seal()
            .build();

        let mut o2 = RouterOptions::default();
        o2.enable_root_prune = false;
        let h2 = RouterBuilder::with_options(o2)
            .add(Method::GET, "/x/:p")
            .add(Method::GET, "/y/static")
            .seal()
            .build();

        for p in ["/x/abc", "/y/static", "/zzz"].iter() {
            assert_eq!(
                h1.find(Method::GET, p).is_some(),
                h2.find(Method::GET, p).is_some()
            );
        }
    }

    #[test]
    fn metrics_are_exposable_and_resettable() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/s/a")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/s/a").is_some());
        let m1 = h.metrics();
        let _ = (
            m1.pattern_first_literal_hits,
            m1.shape_hits,
            m1.shape_misses,
            m1.cand_avg,
            m1.cache_hits,
            m1.cache_lookups,
            m1.cache_misses,
            m1.cand_p50,
            m1.cand_p99,
            m1.static_hits,
        );
        let mut h2 = h;
        h2.reset_metrics();
        let _m2 = h2.metrics();
    }

    #[test]
    fn root_prune_does_not_false_negative_with_wildcard_at_root() {
        let mut o = RouterOptions::default();
        o.enable_root_prune = true;
        let h = RouterBuilder::with_options(o)
            .add(Method::GET, "/*")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/a").is_some());
    }

    #[test]
    fn static_full_map_hits_for_long_paths_when_enabled() {
        let mut o = RouterOptions::default();
        o.enable_static_full_map = true;
        let long = "/a/b/c/d/e/f/g/h/i/j";
        let h = RouterBuilder::with_options(o)
            .add(Method::GET, long)
            .seal()
            .build();
        assert!(h.find(Method::GET, long).is_some());
    }
}

mod edge_cases {
    use super::*;

    #[test]
    fn leading_and_trailing_slashes_variants() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/edge")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/edge/").is_some());
        assert!(h.find(Method::GET, "////edge///").is_none());
    }

    #[test]
    fn head_method_independence_from_get() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::HEAD, "/head")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/head").is_none());
        assert!(h.find(Method::HEAD, "/head").is_some());
    }

    #[test]
    fn wildcard_does_not_match_root() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/*")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/").is_none());
    }

    #[test]
    fn case_insensitive_static_full_map_lookup() {
        let mut o = RouterOptions::default();
        o.case_sensitive = false;
        o.enable_static_full_map = true;
        let h = RouterBuilder::with_options(o)
            .add(Method::GET, "/Case")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/case").is_some());
    }
}

mod deep_tree {
    use super::*;

    #[test]
    fn matches_deep_static_and_param_paths() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .add(Method::GET, "/a/b/c/d/e/:x/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .seal()
            .build();
        assert!(h
            .find(Method::GET, "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_some());
        assert!(h
            .find(Method::GET, "/a/b/c/d/e/ZZ/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v")
            .is_some());
        assert!(h.find(Method::GET, "/a/b/c/d/e").is_none());
    }
}

mod normalization_negative {
    use super::*;

    #[test]
    fn duplicate_slashes_not_normalized_but_trailing_is() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/x/y")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/x//y").is_none());
        assert!(h.find(Method::GET, "/x/y/").is_some());
    }
}

mod builder_no_seal {
    use super::*;

    #[test]
    fn works_without_seal_for_matching() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/ok")
            .build();
        assert!(h.find(Method::GET, "/ok").is_some());
    }
}

mod heavy_pattern_node {
    use super::*;

    #[test]
    fn many_plain_param_patterns_under_same_node_match_correctly() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/p/:n")
            .add(Method::GET, "/p/x")
            .add(Method::GET, "/p/a")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/p/xyz").is_some());
        assert!(h.find(Method::GET, "/p/x").is_some());
        assert!(h.find(Method::GET, "/p/a").is_some());
    }
}

mod options_combinations {
    use super::*;

    #[test]
    fn case_insensitive_with_dup_and_trailing_works_together() {
        let mut o = RouterOptions::default();
        o.case_sensitive = false;
        let h = RouterBuilder::with_options(o)
            .add(Method::GET, "/a/b")
            .seal()
            .build();
        assert!(h.find(Method::GET, "/A//b/").is_none());
    }
}

mod register_route_returns {
    use super::*;

    #[test]
    fn return_true_on_conflict_and_false_on_other_errors() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, 0, "/dup").is_ok());
        assert_eq!(
            rapi::register_route_ex(&mut r, 0, "/dup"),
            RouterError::RouteConflictOnDuplicatePath as u32
        );
        let mut rs = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route_ex(&mut rs, 0, ""),
            RouterError::RoutePathEmpty as u32
        );
        let mut rw = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route_ex(&mut rw, 0, "/x/*/y"),
            RouterError::RouteWildcardSegmentNotAtEnd as u32
        );
        let mut rc = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut rc, 0, "/users/:id").is_ok());
        let code_conf = rapi::register_route_ex(&mut rc, 0, "/users/:name");
        assert_eq!(
            code_conf,
            RouterError::RouteParamNameConflictAtSamePosition as u32
        );
    }
}

mod offsets_variants {
    use super::*;

    #[test]
    fn multi_params_across_segments_offsets() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/pkg/:name/:ver")
            .seal()
            .build();
        let path = "/pkg/lib/2.0.1";
        let mo = h.find_offsets(Method::GET, path).unwrap();
        assert!(mo.key != 0);
        assert_eq!(mo.params.len(), 2);
        let (_i1, (o1, l1)) = mo.params[0];
        let (_i2, (o2, l2)) = mo.params[1];
        assert_eq!(&path[o1..o1 + l1], "lib");
        assert_eq!(&path[o2..o2 + l2], "2.0.1");
    }

    #[test]
    fn wildcard_offsets_after_normalization() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert!(rapi::register_route(&mut r, 0, "/files/*").is_ok());
        rapi::seal(&mut r);
        let m = rapi::match_route(&r, 0, "/files//a/b///").unwrap();
        assert!(m.0 != 0);
        assert_eq!(m.1.len(), 1);
        assert_eq!(m.1[0].0.as_str(), "*");
        assert_eq!(m.1[0].1.as_str(), "a/b");
    }
}

mod param_name_collision_across_levels {
    use super::*;

    #[test]
    fn same_param_name_in_different_segments_is_rejected_and_no_match() {
        let mut r = rapi::Router::with_options(RouterOptions::default(), None);
        assert_eq!(
            rapi::register_route_ex(&mut r, 0, "/a/:x/b/:x"),
            RouterError::RouteDuplicateParamNameInRoute as u32
        );
        rapi::seal(&mut r);
        assert!(rapi::match_route(&r, 0, "/a/AA/b/BB").is_none());
    }
}

mod metrics_semantics {
    use super::*;

    #[test]
    fn pattern_candidate_cache_hits_when_repeated() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/pc/:a/:b")
            .seal()
            .build();
        let mut h2 = h;
        h2.reset_metrics();
        assert!(h2.find(Method::GET, "/pc/aa/bb").is_some());
        assert!(h2.find(Method::GET, "/pc/aa/bb").is_some());
        let m = h2.metrics();
        assert!(m.cache_lookups >= 1);
        assert!(m.cache_hits >= 1);
    }
}

mod interner_ids {
    use super::*;

    #[test]
    fn same_param_name_has_same_id_across_calls() {
        let h = RouterBuilder::with_options(RouterOptions::default())
            .add(Method::GET, "/u/:id")
            .seal()
            .build();
        let mo1 = h.find_offsets(Method::GET, "/u/1").unwrap();
        let mo2 = h.find_offsets(Method::GET, "/u/2").unwrap();
        assert_eq!(mo1.params.len(), 1);
        assert_eq!(mo2.params.len(), 1);
        assert_eq!(mo1.params[0].0, mo2.params[0].0);
    }
}
