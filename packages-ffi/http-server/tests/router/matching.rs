#![allow(clippy::redundant_clone)]
#![allow(clippy::field_reassign_with_default)]

use bunner_http_server::enums::HttpMethod;
use bunner_http_server::router::radix_tree::node::MAX_SEGMENT_LENGTH;
use bunner_http_server::router::{Router, RouterErrorCode};

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
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/users/:id/posts/:post_id").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    let path = "/users/123/posts/abc";
    let m = ro.find(HttpMethod::Get, path).unwrap();
    assert_eq!(m.1.len(), 2);
    assert_eq!(m.1[0].0.as_str(), "id");
    assert_eq!(&path[m.1[0].1.0..m.1[0].1.0 + m.1[0].1.1], "123");
    assert_eq!(m.1[1].0.as_str(), "post_id");
    assert_eq!(&path[m.1[1].1.0..m.1[1].1.0 + m.1[1].1.1], "abc");
}

#[test]
fn finds_wildcard_route_and_captures_value() {
    let mut r = Router::new(None);
    r.add(HttpMethod::Get, "/files/*").unwrap();
    r.finalize();
    let ro = r.build_readonly();
    let path = "/files/a/b/c.txt";
    let m = ro.find(HttpMethod::Get, path).unwrap();
    assert_eq!(m.1.len(), 1);
    assert_eq!(m.1[0].0.as_str(), "*");
    assert_eq!(&path[m.1[0].1.0..m.1[0].1.0 + m.1[0].1.1], "a/b/c.txt");
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

#[test]
fn when_path_is_empty() {
    let r = Router::new(None);
    assert_eq!(
        r.build_readonly()
            .find(HttpMethod::Get, "")
            .map_err(|e| e.code),
        Err(RouterErrorCode::MatchPathEmpty)
    );
}

#[test]
fn when_path_is_not_ascii() {
    let r = Router::new(None);
    assert_eq!(
        r.build_readonly()
            .find(HttpMethod::Get, "/café")
            .map_err(|e| e.code),
        Err(RouterErrorCode::MatchPathNotAscii)
    );
}

#[test]
fn when_path_has_disallowed_chars() {
    let r = Router::new(None);
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
    let mut r = Router::new(None);
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
    let mut r = Router::new(None);
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

#[test]
fn static_wins_over_parametric() {
    let mut r = Router::new(None);
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
    let mut r = Router::new(None);
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
    let mut r = Router::new(None);
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
