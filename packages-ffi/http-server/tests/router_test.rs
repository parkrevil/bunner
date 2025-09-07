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
    use bunner_http_server::router::radix::node::MAX_SEGMENT_PART_LENGTH;

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

    #[test]
    fn rejects_overly_long_segment_literal() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);
        // 256자의 리터럴 세그먼트 생성
        let long_segment = "a".repeat(MAX_SEGMENT_PART_LENGTH + 1);
        let path = format!("/{}", long_segment);
        assert_eq!(
            r.add(HttpMethod::Get, &path),
            Err(RouterError::PatternTooLong)
        );

        // 복합 세그먼트에서도 리터럴 부분의 합이 255자를 초과하는 경우
        let long_prefix = "a".repeat(128);
        let long_suffix = "b".repeat(MAX_SEGMENT_PART_LENGTH - 128 + 1);
        let composite_path = format!("/{}-{}:id", long_prefix, long_suffix);
        // 현재 파서는 복합 세그먼트를 지원하지 않으므로 SyntaxInvalid가 반환됨.
        // 만약 파서가 이를 지원하게 되면, PatternTooLong을 반환해야 함.
        assert!(matches!(
            r.add(HttpMethod::Get, &composite_path),
            Err(RouterError::RouteSegmentContainsMixedParamAndLiteral)
        ));
    }

    #[test]
    fn rejects_various_unsupported_segment_patterns() {
        let mut r = rapi::Router::with_configuration(RouterOptions::default(), None);

        // Case 1: 파라미터 이름에 유효하지 않은 문자가 포함된 경우 (예: '.')
        let invalid_param_patterns = vec![
            "/report/:file.zip",
            "/:name.jpg",
        ];
        for pattern in invalid_param_patterns {
            let result = r.add(HttpMethod::Get, pattern);
            assert!(
                matches!(result, Err(RouterError::RouteParamNameInvalidChar)),
                "Pattern '{}' should be rejected due to invalid characters in param name",
                pattern
            );
        }

        // Case 2: 리터럴과 파라미터가 혼합된 경우 (':'가 맨 앞에 오지 않음)
        let mixed_segment_pattern = "/user-:id";
        let result = r.add(HttpMethod::Get, mixed_segment_pattern);
        assert!(
            matches!(result, Err(RouterError::RouteSegmentContainsMixedParamAndLiteral)),
            "Pattern '{}' should be rejected as a mixed literal and param segment",
            mixed_segment_pattern
        );

        // Case 3: 비어있는 파라미터 이름
        let empty_param_name = "/users/:";
        let result_empty = r.add(HttpMethod::Get, empty_param_name);
        assert!(
            matches!(result_empty, Err(RouterError::RoutePathSyntaxInvalid)),
            "Pattern '{}' should be rejected due to an empty parameter name",
            empty_param_name
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

    #[test]
    fn root_pruning_correctly_filters_requests() {
        let mut opts = RouterOptions::default();
        // 자동 최적화가 켜져 있고 수동으로 비활성화하지 않았으므로,
        // 루트에 동적 경로가 없으면 루트 가지치기가 활성화되어야 합니다.
        opts.enable_automatic_optimization = true;

        let mut r = Router::with_configuration(opts, None);
        r.add(HttpMethod::Get, "/foo/bar").unwrap();
        r.add(HttpMethod::Get, "/bar/baz").unwrap();
        r.add(HttpMethod::Post, "/bar/qux").unwrap();

        r.finalize_routes();

        // 내부 상태를 확인하여 최적화가 활성화되었는지 검증합니다.
        let radix = r.get_internal_radix_router();
        assert!(radix.enable_root_level_pruning, "Root pruning should be auto-enabled");

        // 성공 케이스: 등록된 경로들은 정상적으로 찾아져야 합니다.
        assert!(r.find(HttpMethod::Get, "/foo/bar").is_ok());
        assert!(r.find(HttpMethod::Get, "/bar/baz").is_ok());
        assert!(r.find(HttpMethod::Post, "/bar/qux").is_ok());

        // 실패 케이스 (가지치기 대상):
        // 루트 바로 아래에는 'f'와 'b'로 시작하는 경로만 존재합니다.
        // 따라서 'z'나 'a'로 시작하는 경로는 조기에 필터링되어야 합니다.
        assert!(
            matches!(r.find(HttpMethod::Get, "/zoo"), Err(RouterError::MatchNotFound)),
            "Request for '/zoo' should be pruned at the root"
        );
        assert!(
            matches!(r.find(HttpMethod::Get, "/apple"), Err(RouterError::MatchNotFound)),
            "Request for '/apple' should be pruned at the root"
        );

        // 다른 HTTP 메서드에 대한 요청도 가지치기 되어야 합니다.
        assert!(
            matches!(r.find(HttpMethod::Get, "/bar/qux"), Err(RouterError::MatchNotFound)),
            "GET request for a POST-only route should not be found"
        );
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
                    println!("Successfully added route: /route{}", i);
                    continue;
                }
                Err(e) => {
                    println!("Failed to add route: /route{} - Error: {:?}", i, e);
                    got_err = Some(e);
                    break;
                }
            }
        }

        assert!(got_err.is_some(), "Route limit was not reached within test bounds");
        assert!(matches!(got_err.unwrap(), RouterError::MaxRoutesExceeded));
    }
}

#[cfg(test)]
mod parameter_value_validation {
    use super::*;
    use bunner_http_server::router::radix::node::MAX_SEGMENT_PART_LENGTH;

    #[test]
    fn rejects_parameter_value_exceeding_length_limit() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/users/:id").unwrap();
        r.finalize_routes();

        // 255자 파라미터 값 (허용)
        let long_but_valid_id = "a".repeat(MAX_SEGMENT_PART_LENGTH);
        let valid_path = format!("/users/{}", long_but_valid_id);
        let match_result = r.find(HttpMethod::Get, &valid_path);
        assert!(match_result.is_ok(), "Should successfully match a 255-character parameter value");
        if let Ok((_, params)) = match_result {
            assert_eq!(params[0].1, long_but_valid_id);
        }

        // 256자 파라미터 값 (거부)
        let too_long_id = "b".repeat(MAX_SEGMENT_PART_LENGTH + 1);
        let invalid_path = format!("/users/{}", too_long_id);
        let match_result_fail = r.find(HttpMethod::Get, &invalid_path);
        assert!(
            matches!(match_result_fail, Err(RouterError::MatchNotFound)),
            "Should fail to match a 256-character parameter value and return MatchNotFound"
        );
    }

    #[test]
    fn allows_long_wildcard_value() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/assets/*").unwrap();
        r.finalize_routes();

        // 와일드카드 값은 현재 길이 제한이 없으므로 매우 긴 값도 허용되어야 함
        let very_long_path_segment = "a".repeat(1000);
        let path = format!("/assets/css/themes/{}", very_long_path_segment);
        let match_result = r.find(HttpMethod::Get, &path);
        assert!(match_result.is_ok(), "Wildcard should match a very long path");
        if let Ok((_, params)) = match_result {
            assert_eq!(params[0].0, "*");
            assert_eq!(params[0].1, format!("css/themes/{}", very_long_path_segment));
        }
    }
}

#[cfg(test)]
mod malicious_inputs {
    use super::*;

    #[test]
    fn handles_extremely_deep_paths() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        let deep_path = "/".to_string() + &"a/".repeat(100) + ":id";
        
        // 등록 시도 (세그먼트 개수는 제한 없으므로 성공해야 함)
        assert!(r.add(HttpMethod::Get, &deep_path).is_ok());
        r.finalize_routes();

        let request_path = "/".to_string() + &"a/".repeat(100) + "123";
        let result = r.find(HttpMethod::Get, &request_path);
        
        assert!(result.is_ok(), "Should handle extremely deep paths");
        if let Ok((_, params)) = result {
            assert_eq!(params.len(), 1);
            assert_eq!(params[0].0, "id");
            assert_eq!(params[0].1, "123");
        }
    }

    #[test]
    fn handles_path_with_many_parameters() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        // 30개의 파라미터를 가진 경로
        let mut path = String::new();
        for i in 0..30 {
            path.push_str(&format!("/:param{}", i));
        }
        
        assert!(r.add(HttpMethod::Get, &path).is_ok());
        r.finalize_routes();

        let mut request_path = String::new();
        for i in 0..30 {
            request_path.push_str(&format!("/value{}", i));
        }

        let result = r.find(HttpMethod::Get, &request_path);
        assert!(result.is_ok(), "Should handle paths with a large number of parameters");
        if let Ok((_, params)) = result {
            assert_eq!(params.len(), 30);
            for i in 0..30 {
                assert_eq!(params[i].0, format!("param{}", i));
                assert_eq!(params[i].1, format!("value{}", i));
            }
        }
    }

    #[test]
    fn rejects_path_with_extremely_long_non_matching_segment() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        r.add(HttpMethod::Get, "/a/b/c").unwrap();
        r.finalize_routes();
        
        // 10,000자의 매칭되지 않는 세그먼트
        let long_segment = "x".repeat(10000);
        let path = format!("/a/{}/c", long_segment);

        // 검색 시 매우 긴 입력에 대해 DoS에 빠지지 않고 즉시 실패해야 함
        let result = r.find(HttpMethod::Get, &path);
        assert!(matches!(result, Err(RouterError::MatchNotFound)));
    }

    #[test]
    fn handles_repetitive_path_patterns_efficiently() {
        let mut r = Router::with_configuration(RouterOptions::default(), None);
        // 유사하지만 다른 경로들을 많이 등록 (최적화 로직 테스트)
        for i in 0..50 {
            r.add(HttpMethod::Get, &format!("/path/a{}/end", i)).unwrap();
            r.add(HttpMethod::Get, &format!("/path/b{}/end", i)).unwrap();
        }
        r.finalize_routes();

        assert!(r.find(HttpMethod::Get, "/path/a25/end").is_ok());
        assert!(r.find(HttpMethod::Get, "/path/b40/end").is_ok());
        assert!(r.find(HttpMethod::Get, "/path/c10/end").is_err());
    }
}

mod security_validation {
    use super::*;

    #[test]
    fn directory_traversal_is_treated_as_literal() {
        let mut router = Router::new();
        router.add(HttpMethod::Get, "/users/../posts").unwrap();

        // Ensure it matches the literal path including "..", not the "normalized" path
        assert!(router.find(HttpMethod::Get, "/users/../posts").is_ok());
        assert!(router.find(HttpMethod::Get, "/posts").is_err());
    }

    #[test]
    fn rejects_paths_with_null_bytes() {
        let mut router = Router::new();
        let path_with_null = "/file/image.jpg\0.txt";

        // Test adding a route with a null byte
        let add_result = router.add(HttpMethod::Get, path_with_null);
        assert_eq!(
            add_result,
            Err(RouterError::RoutePathContainsDisallowedCharacters)
        );

        // Test finding a route with a null byte
        router.add(HttpMethod::Get, "/file/:name").unwrap();
        let find_result = router.find(HttpMethod::Get, path_with_null);
        assert_eq!(
            find_result,
            Err(RouterError::MatchPathContainsDisallowedCharacters)
        );
    }

    #[test]
    fn rejects_paths_with_percent_encoded_special_chars() {
        let mut router = Router::new();

        // Percent-encoded slash (%2f)
        let path_with_encoded_slash = "/a/b%2fc";
        assert_eq!(
            router.add(HttpMethod::Get, path_with_encoded_slash),
            Err(RouterError::RoutePathContainsDisallowedCharacters)
        );
        assert_eq!(
            router.find(HttpMethod::Get, path_with_encoded_slash),
            Err(RouterError::MatchPathContainsDisallowedCharacters)
        );

        // Percent-encoded dot (%2e) - part of a traversal attempt
        let path_with_encoded_traversal = "/a/%2e%2e/b";
        assert_eq!(
            router.add(HttpMethod::Get, path_with_encoded_traversal),
            Err(RouterError::RoutePathContainsDisallowedCharacters)
        );
        assert_eq!(
            router.find(HttpMethod::Get, path_with_encoded_traversal),
            Err(RouterError::MatchPathContainsDisallowedCharacters)
        );
    }
}
