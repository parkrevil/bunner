#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::radix_tree::node::MAX_SEGMENT_LENGTH;
use bunner_http_server::router::{
    self as rapi, Router, RouterError, RouterErrorCode, RouterOptions,
};

mod registration {
    use super::*;
    mod success {
        use super::*;

        #[test]
        fn registers_static_route_at_root() {
            let mut r = Router::new(None);
            assert!(r.add(HttpMethod::Get, "/").is_ok());
        }

        #[test]
        fn registers_static_route_at_nested_path() {
            let mut r = Router::new(None);
            assert!(r.add(HttpMethod::Get, "/health").is_ok());
            assert!(r.add(HttpMethod::Post, "/health").is_ok());
        }

        #[test]
        fn registers_parametric_route() {
            let mut r = rapi::Router::new(None);
            assert!(r.add(HttpMethod::Get, "/users/:id").is_ok());
        }

        #[test]
        fn registers_wildcard_route() {
            let mut r = Router::new(None);
            assert!(r.add(HttpMethod::Get, "/files/*").is_ok());
        }
    }
    mod failure {
        use super::*;

        #[test]
        fn when_path_is_empty() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "").map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathEmpty)
            );
        }

        #[test]
        fn when_path_is_not_ascii() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/café").map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathNotAscii)
            );
        }

        #[test]
        fn when_path_has_disallowed_chars() {
            let mut r = rapi::Router::new(None);
            for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
                assert_eq!(
                    r.add(HttpMethod::Get, p).map_err(|e| e.code),
                    Err(RouterErrorCode::RoutePathContainsDisallowedCharacters)
                );
            }
        }

        #[test]
        fn when_path_syntax_is_invalid() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/a/:()").map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathSyntaxInvalid)
            );
            assert_eq!(
                r.add(HttpMethod::Get, "/users/:").map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathSyntaxInvalid)
            );
        }

        #[test]
        fn when_param_name_starts_with_invalid_char() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/:1bad").map_err(|e| e.code),
                Err(RouterErrorCode::RouteParamNameInvalidStart)
            );
        }

        #[test]
        fn when_param_name_contains_invalid_chars() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/:bad-name").map_err(|e| e.code),
                Err(RouterErrorCode::RouteParamNameInvalidChar)
            );
            assert_eq!(
                r.add(HttpMethod::Get, "/:file.zip").map_err(|e| e.code),
                Err(RouterErrorCode::RouteParamNameInvalidChar)
            );
        }

        #[test]
        fn when_segment_has_mixed_literal_and_param() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/user-:id").map_err(|e| e.code),
                Err(RouterErrorCode::RouteSegmentContainsMixedParamAndLiteral)
            );
        }

        #[test]
        fn when_param_name_is_duplicated_across_segments() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/a/:x/b/:x").map_err(|e| e.code),
                Err(RouterErrorCode::RouteDuplicateParamNameInRoute)
            );
        }

        #[test]
        fn when_wildcard_is_not_at_the_end() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add(HttpMethod::Get, "/a/*/b").map_err(|e| e.code),
                Err(RouterErrorCode::RouteWildcardSegmentNotAtEnd)
            );
        }

        #[test]
        fn when_duplicate_static_path() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/dup").unwrap();
            assert_eq!(
                r.add(HttpMethod::Get, "/dup").map_err(|e| e.code),
                Err(RouterErrorCode::RouteConflictOnDuplicatePath)
            );
        }

        #[test]
        fn when_conflicting_parameter_names() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/users/:id").unwrap();
            assert_eq!(
                r.add(HttpMethod::Get, "/users/:name").map_err(|e| e.code),
                Err(RouterErrorCode::RouteParamNameConflictAtSamePosition)
            );
        }

        #[test]
        fn when_duplicate_wildcard() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/a/*").unwrap();
            assert_eq!(
                r.add(HttpMethod::Get, "/a/*").map_err(|e| e.code),
                Err(RouterErrorCode::RouteWildcardAlreadyExistsForMethod)
            );
        }

        #[test]
        fn when_router_is_finalized() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/ok").unwrap();
            r.finalize();
            assert_eq!(
                r.add(HttpMethod::Get, "/x").map_err(|e| e.code),
                Err(RouterErrorCode::RouterSealedCannotInsert)
            );
        }

        #[test]
        fn when_max_routes_limit_is_exceeded() {
            let opts = RouterOptions::default();
            let mut r = Router::new(Some(opts));
            let mut got_err: Option<RouterError> = None;

            for i in 0..=100 {
                let path = format!("/route{}", i);
                if let Err(e) = r.add(HttpMethod::Get, &path) {
                    got_err = Some(e);
                    break;
                }
            }
            assert!(matches!(got_err, Some(e) if e.code == RouterErrorCode::MaxRoutesExceeded));
        }

        #[test]
        fn when_segment_literal_is_too_long() {
            let mut r = rapi::Router::new(None);
            let long_segment = "a".repeat(MAX_SEGMENT_LENGTH + 1);
            let path = format!("/{}", long_segment);
            assert_eq!(
                r.add(HttpMethod::Get, &path).map_err(|e| e.code),
                Err(RouterErrorCode::PatternTooLong)
            );
        }
    }
}

// Bulk insert variants mirroring the registration tests
mod bulk_registration {
    use super::*;

    mod success {
        use super::*;

        #[test]
        fn registers_static_route_at_root() {
            let mut r = Router::new(None);
            let out = r.add_bulk(vec![(HttpMethod::Get, "/".to_string())]);
            assert!(out.is_ok());
            assert_eq!(out.unwrap().len(), 1);
        }

        #[test]
        fn registers_static_route_at_nested_path() {
            let mut r = Router::new(None);
            let out = r.add_bulk(vec![
                (HttpMethod::Get, "/health".to_string()),
                (HttpMethod::Post, "/health".to_string()),
            ]);
            assert!(out.is_ok());
            assert_eq!(out.unwrap().len(), 2);
        }

        #[test]
        fn registers_parametric_route() {
            let mut r = rapi::Router::new(None);
            let out = r.add_bulk(vec![(HttpMethod::Get, "/users/:id".to_string())]);
            assert!(out.is_ok());
        }

        #[test]
        fn registers_wildcard_route() {
            let mut r = Router::new(None);
            let out = r.add_bulk(vec![(HttpMethod::Get, "/files/*".to_string())]);
            assert!(out.is_ok());
        }

        #[test]
        fn registers_multiple_and_preserves_order() {
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
        fn uses_multiple_workers_on_large_batch_when_possible() {
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
        fn uses_single_worker_for_tiny_batch() {
            let mut r = Router::new(None);
            r.reset_bulk_metrics();
            let _ = r.add_bulk(vec![(HttpMethod::Get, "/t1".to_string())]);
            let (used, _max_active) = r.bulk_metrics();
            assert_eq!(used, 1);
        }
    }

    mod failure {
        use super::*;

        #[test]
        fn when_path_is_empty() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathEmpty)
            );
        }

        #[test]
        fn when_path_is_not_ascii() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "/café".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RoutePathNotAscii)
            );
        }

        #[test]
        fn when_path_has_disallowed_chars() {
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
        fn when_path_syntax_is_invalid() {
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
        fn when_param_name_starts_with_invalid_char() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "/:1bad".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RouteParamNameInvalidStart)
            );
        }

        #[test]
        fn when_param_name_contains_invalid_chars() {
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
        fn when_segment_has_mixed_literal_and_param() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "/user-:id".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RouteSegmentContainsMixedParamAndLiteral)
            );
        }

        #[test]
        fn when_param_name_is_duplicated_across_segments() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "/a/:x/b/:x".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RouteDuplicateParamNameInRoute)
            );
        }

        #[test]
        fn when_wildcard_is_not_at_the_end() {
            let mut r = rapi::Router::new(None);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, "/a/*/b".to_string())])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::RouteWildcardSegmentNotAtEnd)
            );
        }

        #[test]
        fn when_duplicate_static_path() {
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
        fn all_or_nothing_when_any_error_in_batch() {
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
        fn when_max_routes_limit_is_exceeded_no_partial_commit() {
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
        fn when_conflicting_parameter_names() {
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
        fn when_duplicate_wildcard() {
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
        fn when_router_is_finalized() {
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
        fn when_max_routes_limit_is_exceeded() {
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
        fn when_segment_literal_is_too_long() {
            let mut r = rapi::Router::new(None);
            let long_segment = "a".repeat(MAX_SEGMENT_LENGTH + 1);
            let path = format!("/{}", long_segment);
            assert_eq!(
                r.add_bulk(vec![(HttpMethod::Get, path)])
                    .map_err(|e| e.code),
                Err(RouterErrorCode::PatternTooLong)
            );
        }
    }
}

mod matching {
    use super::*;
    mod success {
        use super::*;

        #[test]
        fn finds_static_route() {
            let mut r = Router::new(None);
            r.add(HttpMethod::Get, "/").unwrap();
            r.add(HttpMethod::Get, "/health").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            assert!(ro.find(HttpMethod::Get, "/").is_ok());
            assert!(ro.find(HttpMethod::Get, "/health").is_ok());
        }

        #[test]
        fn finds_parametric_route_and_captures_values() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/users/:id/posts/:post_id").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            let m = ro.find(HttpMethod::Get, "/users/123/posts/abc").unwrap();
            assert_eq!(m.1.len(), 2);
            assert_eq!(m.1[0].0.as_str(), "id");
            assert_eq!(m.1[0].1.as_str(), "123");
            assert_eq!(m.1[1].0.as_str(), "post_id");
            assert_eq!(m.1[1].1.as_str(), "abc");
        }

        #[test]
        fn finds_wildcard_route_and_captures_value() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/files/*").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            let m = ro.find(HttpMethod::Get, "/files/a/b/c.txt").unwrap();
            assert_eq!(m.1.len(), 1);
            assert_eq!(m.1[0].0.as_str(), "*");
            assert_eq!(m.1[0].1.as_str(), "a/b/c.txt");
        }

        #[test]
        fn finds_wildcard_route_with_empty_value() {
            let mut r = Router::new(None);
            r.add(HttpMethod::Get, "/files/*").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            let m = ro.find(HttpMethod::Get, "/files/").unwrap();
            assert_eq!(
                m.1.len(),
                0,
                "Wildcard should capture an empty value for '/files/'"
            );
            let m2 = ro.find(HttpMethod::Get, "/files").unwrap();
            assert_eq!(
                m2.1.len(),
                0,
                "Wildcard should capture an empty value for '/files'"
            );
        }
    }
    mod failure {
        use super::*;

        #[test]
        fn when_path_is_empty() {
            let r = rapi::Router::new(None);
            assert_eq!(
                r.build_readonly()
                    .find(HttpMethod::Get, "")
                    .map_err(|e| e.code),
                Err(RouterErrorCode::MatchPathEmpty)
            );
        }

        #[test]
        fn when_path_is_not_ascii() {
            let r = rapi::Router::new(None);
            assert_eq!(
                r.build_readonly()
                    .find(HttpMethod::Get, "/café")
                    .map_err(|e| e.code),
                Err(RouterErrorCode::MatchPathNotAscii)
            );
        }

        #[test]
        fn when_path_has_disallowed_chars() {
            let r = rapi::Router::new(None);
            for p in ["/a b", "/a?b", "/a#b", "/a%b"].iter() {
                assert_eq!(
                    r.build_readonly()
                        .find(HttpMethod::Get, p)
                        .map_err(|e| e.code),
                    Err(RouterErrorCode::MatchPathContainsDisallowedCharacters)
                );
            }
        }

        #[test]
        fn when_no_route_is_found() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/ok").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            assert_eq!(
                ro.find(HttpMethod::Get, "/missing").map_err(|e| e.code),
                Err(RouterErrorCode::MatchNotFound)
            );
        }

        #[test]
        fn when_method_is_wrong() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/only-get").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            assert!(ro.find(HttpMethod::Post, "/only-get").is_err());
        }

        #[test]
        fn when_parameter_value_is_too_long() {
            let mut r = Router::new(None);
            r.add(HttpMethod::Get, "/users/:id").unwrap();
            r.finalize();
            let too_long_id = "b".repeat(MAX_SEGMENT_LENGTH + 1);
            let invalid_path = format!("/users/{}", too_long_id);
            let ro = r.build_readonly();
            assert!(matches!(
                ro.find(HttpMethod::Get, &invalid_path).map_err(|e| e.code),
                Err(RouterErrorCode::MatchNotFound)
            ));
        }
    }
    mod precedence {
        use super::*;

        #[test]
        fn static_wins_over_parametric() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/users/:id").unwrap();
            let k_static = r.add(HttpMethod::Get, "/users/me").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            let m = ro.find(HttpMethod::Get, "/users/me").unwrap();
            assert_eq!(m.0, k_static);
            assert!(m.1.is_empty());
        }

        #[test]
        fn static_wins_over_wildcard() {
            let mut r = rapi::Router::new(None);
            r.add(HttpMethod::Get, "/f/*").unwrap();
            let k_static = r.add(HttpMethod::Get, "/f/static").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            let m = ro.find(HttpMethod::Get, "/f/static").unwrap();
            assert_eq!(m.0, k_static);
        }

        // 참고: 파라미터 vs 와일드카드 우선순위는 현재 라우터 구현상
        // 파라미터가 항상 이기지만, 이를 명시적으로 보장하는 테스트도 추가.
        #[test]
        fn parametric_wins_over_wildcard() {
            let mut r = rapi::Router::new(None);
            let k_wildcard = r.add(HttpMethod::Get, "/search/*").unwrap();
            let k_param = r.add(HttpMethod::Get, "/search/:query").unwrap();
            r.finalize();
            let ro = r.build_readonly();

            let m_param = ro.find(HttpMethod::Get, "/search/rust-lang").unwrap();
            assert_eq!(m_param.0, k_param);
            assert_eq!(m_param.1.len(), 1);

            let m_wildcard = ro.find(HttpMethod::Get, "/search/rust/lang").unwrap();
            assert_eq!(m_wildcard.0, k_wildcard);
        }
    }
}

mod behavior {
    use super::*;
    mod normalization {
        use super::*;

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
    }
    mod case_sensitivity {
        use super::*;
        #[test]
        fn is_always_case_sensitive() {
            let mut r = Router::new(None);
            r.add(HttpMethod::Get, "/About").unwrap();
            r.finalize();
            let ro = r.build_readonly();
            assert!(ro.find(HttpMethod::Get, "/about").is_err());
            assert!(ro.find(HttpMethod::Get, "/About").is_ok());
        }
    }
    mod lifecycle {
        use super::*;
        #[test]
        fn allows_matching_before_finalization() {
            let mut r = Router::new(None);
            r.add(HttpMethod::Get, "/ok").unwrap();
            let ro = r.build_readonly();
            assert!(ro.find(HttpMethod::Get, "/ok").is_ok());
        }
    }
}

mod security {
    use super::*;
    mod path_traversal {
        use super::*;
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
    }
    mod injection {
        use super::*;
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
    }
    mod denial_of_service {
        use super::*;
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
            assert_eq!(m.1[0].1.as_str(), "special'chars()*,;=");
        }
    }
}

mod optimizations {
    use super::*;
    mod root_pruning {
        use super::*;
        #[test]
        fn is_functionally_equivalent() {
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
    }
    mod static_map {
        use super::*;
        #[test]
        fn is_functionally_equivalent() {
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
    }
    mod automatic {
        use super::*;
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
    }
}
