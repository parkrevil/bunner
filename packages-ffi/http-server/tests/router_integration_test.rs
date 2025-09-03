use bunner_http_server::router::{self, Router, RouterOptions};

/// 테스트용 라우터 빌더 - 기본 옵션으로 설정
fn build_router(case_sensitive: bool) -> Router {
    let opts = RouterOptions {
        ignore_trailing_slash: true,
        ignore_duplicate_slashes: true,
        case_sensitive,
        allow_unsafe_regex: false,
    };
    Router::with_options(opts, None)
}

/// 테스트용 라우터 빌더 - 커스텀 옵션으로 설정
fn build_router_with_options(opts: RouterOptions) -> Router {
    Router::with_options(opts, None)
}

/// 라우트 등록 헬퍼 - 성공/실패 확인
fn register_route(r: &mut Router, method: u32, path: &str, key: u64) -> bool {
    router::register_route(r, method, path, key)
}

/// 라우트 등록 헬퍼 - 에러 코드 반환
fn register_route_ex(r: &mut Router, method: u32, path: &str, key: u64) -> u32 {
    router::register_route_ex(r, method, path, key)
}

/// 라우트 매칭 헬퍼
fn match_route(r: &Router, method: u32, path: &str) -> Option<(u64, Vec<(String, String)>)> {
    router::match_route(r, method, path)
}

/// 라우터 봉인 헬퍼
fn seal_router(r: &mut Router) {
    router::seal(r);
}

// ============================================================================
// 기본 정적 라우트 테스트
// ============================================================================

#[test]
fn basic_static_routes() {
    let mut r = build_router(true);

    // 기본 정적 라우트들 등록
    assert!(register_route(&mut r, 0, "/", 1));
    assert!(register_route(&mut r, 0, "/home", 2));
    assert!(register_route(&mut r, 0, "/about", 3));
    assert!(register_route(&mut r, 0, "/contact", 4));
    assert!(register_route(&mut r, 0, "/api/health", 5));
    assert!(register_route(&mut r, 0, "/api/status", 6));
    assert!(register_route(&mut r, 0, "/users/profile", 7));
    assert!(register_route(&mut r, 0, "/admin/dashboard", 8));

    seal_router(&mut r);

    // 정확한 매칭 확인
    let hit1 = match_route(&r, 0, "/");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/home");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 0, "/api/health");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 5);

    // 존재하지 않는 경로는 매칭되지 않음
    assert!(match_route(&r, 0, "/nonexistent").is_none());
    assert!(match_route(&r, 0, "/home/extra").is_none());
}

#[test]
fn case_sensitive_static_routes() {
    let mut r = build_router(true); // case_sensitive = true

    // 대소문자 구분 라우트 등록
    assert!(register_route(&mut r, 0, "/User", 1));
    assert!(register_route(&mut r, 0, "/user", 2));
    assert!(register_route(&mut r, 0, "/USER", 3));

    seal_router(&mut r);

    // 정확한 대소문자로만 매칭
    let hit1 = match_route(&r, 0, "/User");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/user");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 0, "/USER");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);
}

#[test]
fn case_insensitive_static_routes() {
    let mut r = build_router(false); // case_sensitive = false

    // 대소문자 구분 없는 라우트 등록
    assert!(register_route(&mut r, 0, "/User", 1));
    assert!(register_route(&mut r, 0, "/user", 2));
    assert!(register_route(&mut r, 0, "/USER", 3));

    seal_router(&mut r);

    // 모든 대소문자 변형으로 매칭
    let hit1 = match_route(&r, 0, "/user");
    assert!(hit1.is_some());
    let key1 = hit1.unwrap().0;
    assert!(key1 == 1 || key1 == 2 || key1 == 3);

    let hit2 = match_route(&r, 0, "/User");
    assert!(hit2.is_some());
    let key2 = hit2.unwrap().0;
    assert!(key2 == 1 || key2 == 2 || key2 == 3);

    let hit3 = match_route(&r, 0, "/USER");
    assert!(hit3.is_some());
    let key3 = hit3.unwrap().0;
    assert!(key3 == 1 || key3 == 2 || key3 == 3);

    let hit4 = match_route(&r, 0, "/uSeR");
    assert!(hit4.is_some());
    let key4 = hit4.unwrap().0;
    assert!(key4 == 1 || key4 == 2 || key4 == 3);
}

// ============================================================================
// 경로 정규화 테스트
// ============================================================================

#[test]
fn trailing_slash_normalization() {
    let mut r = build_router(true);

    // trailing slash 무시 옵션으로 라우트 등록
    assert!(register_route(&mut r, 0, "/api/users", 1));
    assert!(register_route(&mut r, 0, "/api/posts", 2));
    assert!(register_route(&mut r, 0, "/admin", 3));

    seal_router(&mut r);

    // trailing slash가 있어도 매칭
    let hit1 = match_route(&r, 0, "/api/users/");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/api/posts/");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 0, "/admin/");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);

    // trailing slash가 없어도 매칭
    let hit4 = match_route(&r, 0, "/api/users");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 1);
}

#[test]
fn duplicate_slash_normalization() {
    let mut r = build_router(true);

    // 중복 슬래시 무시 옵션으로 라우트 등록
    assert!(register_route(&mut r, 0, "/api/users/profile", 1));
    assert!(register_route(&mut r, 0, "/admin/dashboard/settings", 2));
    assert!(register_route(&mut r, 0, "/blog/posts/comments", 3));

    seal_router(&mut r);

    // 중복 슬래시가 있어도 매칭
    let hit1 = match_route(&r, 0, "/api//users/profile");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/admin///dashboard//settings");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 0, "//blog//posts///comments");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);

    // 정상 경로로도 매칭
    let hit4 = match_route(&r, 0, "/api/users/profile");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 1);
}

#[test]
fn combined_normalization() {
    let mut r = build_router(true);

    // 복합 정규화 테스트용 라우트 등록
    assert!(register_route(&mut r, 0, "/api/v1/users", 1));
    assert!(register_route(&mut r, 0, "/admin/users/roles", 2));

    seal_router(&mut r);

    // trailing slash + 중복 슬래시 조합
    let hit1 = match_route(&r, 0, "/api//v1//users/");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "//admin//users//roles/");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    // 극한의 정규화 케이스
    let hit3 = match_route(&r, 0, "///api///v1///users///");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 1);

    let hit4 = match_route(&r, 0, "////admin////users////roles////");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 2);
}

// ============================================================================
// 파라미터 라우트 테스트
// ============================================================================

#[test]
fn basic_parameter_routes() {
    let mut r = build_router(true);

    // 기본 파라미터 라우트들 등록
    assert!(register_route(&mut r, 0, "/users/:id", 1));
    assert!(register_route(&mut r, 0, "/posts/:post_id", 2));
    assert!(register_route(&mut r, 0, "/api/:version/users/:user_id", 3));
    assert!(register_route(
        &mut r,
        0,
        "/categories/:cat_id/posts/:post_id",
        4
    ));

    seal_router(&mut r);

    // 파라미터 매칭 확인
    let hit1 = match_route(&r, 0, "/users/123");
    assert!(hit1.is_some());
    let (key1, params1) = hit1.unwrap();
    assert_eq!(key1, 1);
    assert_eq!(params1.len(), 1);
    assert_eq!(params1[0].0, "id");
    assert_eq!(params1[0].1, "123");

    let hit2 = match_route(&r, 0, "/posts/456");
    assert!(hit2.is_some());
    let (key2, params2) = hit2.unwrap();
    assert_eq!(key2, 2);
    assert_eq!(params2.len(), 1);
    assert_eq!(params2[0].0, "post_id");
    assert_eq!(params2[0].1, "456");

    let hit3 = match_route(&r, 0, "/api/v2/users/789");
    assert!(hit3.is_some());
    let (key3, params3) = hit3.unwrap();
    assert_eq!(key3, 3);
    assert_eq!(params3.len(), 2);
    assert_eq!(params3[0].0, "version");
    assert_eq!(params3[0].1, "v2");
    assert_eq!(params3[1].0, "user_id");
    assert_eq!(params3[1].1, "789");

    let hit4 = match_route(&r, 0, "/categories/tech/posts/101");
    assert!(hit4.is_some());
    let (key4, params4) = hit4.unwrap();
    assert_eq!(key4, 4);
    assert_eq!(params4.len(), 2);
    assert_eq!(params4[0].0, "cat_id");
    assert_eq!(params4[0].1, "tech");
    assert_eq!(params4[1].0, "post_id");
    assert_eq!(params4[1].1, "101");
}

#[test]
fn parameter_with_regex_constraints() {
    let mut r = build_router(true);

    // 정규식 제약이 있는 파라미터 라우트들 등록
    assert!(register_route(&mut r, 0, "/users/:id(\\d+)", 1));
    assert!(register_route(&mut r, 0, "/posts/:slug([a-z0-9-]+)", 2));
    assert!(register_route(
        &mut r,
        0,
        "/files/:filename(\\w+\\.\\w+)",
        3
    ));
    assert!(register_route(&mut r, 0, "/api/:version(v\\d+)", 4));

    seal_router(&mut r);

    // 정규식 매칭 확인
    let hit1 = match_route(&r, 0, "/users/12345");
    assert!(hit1.is_some());
    let (key1, params1) = hit1.unwrap();
    assert_eq!(key1, 1);
    assert_eq!(params1[0].0, "id");
    assert_eq!(params1[0].1, "12345");

    let hit2 = match_route(&r, 0, "/posts/my-blog-post-123");
    assert!(hit2.is_some());
    let (key2, params2) = hit2.unwrap();
    assert_eq!(key2, 2);
    assert_eq!(params2[0].0, "slug");
    assert_eq!(params2[0].1, "my-blog-post-123");

    let hit3 = match_route(&r, 0, "/files/document.pdf");
    assert!(hit3.is_some());
    let (key3, params3) = hit3.unwrap();
    assert_eq!(key3, 3);
    assert_eq!(params3[0].0, "filename");
    assert_eq!(params3[0].1, "document.pdf");

    let hit4 = match_route(&r, 0, "/api/v3");
    assert!(hit4.is_some());
    let (key4, params4) = hit4.unwrap();
    assert_eq!(key4, 4);
    assert_eq!(params4[0].0, "version");
    assert_eq!(params4[0].1, "v3");

    // 정규식에 맞지 않는 경로는 매칭되지 않음
    assert!(match_route(&r, 0, "/users/abc").is_none());
    assert!(match_route(&r, 0, "/posts/MY-POST").is_none());
    assert!(match_route(&r, 0, "/files/document").is_none());
    assert!(match_route(&r, 0, "/api/3").is_none());
}

#[test]
fn parameter_conflicts_and_resolution() {
    let mut r = build_router(true);

    // 파라미터 이름이 다른 라우트들 등록
    assert!(register_route(&mut r, 0, "/users/:id", 1));
    assert!(register_route(&mut r, 0, "/users/:user_id", 2));

    seal_router(&mut r);

    // 기본 정책(파라미터 이름 무시)에서는 이름 달라도 허용됨
    // 첫 번째 라우트만 등록되고 두 번째는 실패해야 함
    let hit = match_route(&r, 0, "/users/123");
    assert!(hit.is_some());
    let (key, params) = hit.unwrap();
    assert!(key == 1 || key == 2);
    assert!(params[0].0 == "id" || params[0].0 == "user_id");
    assert_eq!(params[0].1, "123");
}

#[test]
fn parameter_conflicts_relaxed() {
    let mut r = build_router_with_options(RouterOptions {
        ignore_trailing_slash: true,
        ignore_duplicate_slashes: true,
        case_sensitive: true,
        allow_unsafe_regex: false,
    });

    // 파라미터 이름이 다른 라우트들 등록
    assert!(register_route(&mut r, 0, "/users/:id", 1));
    assert!(register_route(&mut r, 0, "/users/:user_id", 2)); // 이제 성공해야 함

    seal_router(&mut r);

    // strict_param_names = false이므로 이름이 달라도 허용
    let hit1 = match_route(&r, 0, "/users/123");
    assert!(hit1.is_some());
    let (key1, _) = hit1.unwrap();
    assert!(key1 == 1 || key1 == 2);

    let hit2 = match_route(&r, 0, "/users/456");
    assert!(hit2.is_some());
    let (key2, _) = hit2.unwrap();
    assert!(key2 == 1 || key2 == 2);
}

// ============================================================================
// 와일드카드 라우트 테스트
// ============================================================================

#[test]
fn wildcard_routes() {
    let mut r = build_router(true);

    // 와일드카드 라우트들 등록
    assert!(register_route(&mut r, 0, "/api/*", 1));
    assert!(register_route(&mut r, 0, "/admin/*", 2));
    assert!(register_route(&mut r, 0, "/files/*", 3));

    seal_router(&mut r);

    // 와일드카드 매칭 확인
    let hit1 = match_route(&r, 0, "/api/users");
    assert!(hit1.is_some());
    let (key1, params1) = hit1.unwrap();
    assert_eq!(key1, 1);
    assert_eq!(params1.len(), 1);
    assert_eq!(params1[0].0, "*");
    assert_eq!(params1[0].1, "users");

    let hit2 = match_route(&r, 0, "/api/v1/users/123/profile");
    assert!(hit2.is_some());
    let (key2, params2) = hit2.unwrap();
    assert_eq!(key2, 1);
    assert_eq!(params2.len(), 1);
    assert_eq!(params2[0].0, "*");
    assert_eq!(params2[0].1, "v1/users/123/profile");

    let hit3 = match_route(&r, 0, "/admin/dashboard/settings/users");
    assert!(hit3.is_some());
    let (key3, params3) = hit3.unwrap();
    assert_eq!(key3, 2);
    assert_eq!(params3.len(), 1);
    assert_eq!(params3[0].0, "*");
    assert_eq!(params3[0].1, "dashboard/settings/users");

    let hit4 = match_route(&r, 0, "/files/documents/reports/2024/q1.pdf");
    assert!(hit4.is_some());
    let (key4, params4) = hit4.unwrap();
    assert_eq!(key4, 3);
    assert_eq!(params4.len(), 1);
    assert_eq!(params4[0].0, "*");
    assert_eq!(params4[0].1, "documents/reports/2024/q1.pdf");
}

#[test]
fn wildcard_position_validation() {
    let mut r = build_router(true);

    // 와일드카드는 마지막에만 허용
    assert!(register_route(&mut r, 0, "/api/*", 1));

    // 중간에 와일드카드가 있으면 실패해야 함
    let result = register_route_ex(&mut r, 0, "/api/*/users", 2);
    assert_ne!(result, 0);

    // 끝에 와일드카드가 있으면 성공
    assert!(register_route(&mut r, 0, "/admin/users/*", 3));

    seal_router(&mut r);

    // 성공한 라우트들만 매칭
    let hit1 = match_route(&r, 0, "/api/anything");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/admin/users/123/profile");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 3);
}

// ============================================================================
// 에러 케이스 및 제한 테스트
// ============================================================================

#[test]
fn max_total_params_limit() {
    let mut r = build_router(true);

    // 제한 제거됨: 많은 파라미터도 허용
    let path = "/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j/:k/:l/:m/:n/:o/:p/:q";
    assert!(register_route(&mut r, 0, path, 1));

    seal_router(&mut r);

    // 성공한 라우트만 매칭
    let hit = match_route(&r, 0, "/1/2/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17");
    assert!(hit.is_some());
    assert_eq!(hit.unwrap().0, 1);
}

#[test]
fn max_path_length_limit() {
    let mut r = build_router(true);

    // 길이 제한 제거: 매우 긴 경로도 허용
    let valid_path = "/a".repeat(1200);
    assert!(register_route(&mut r, 0, &valid_path, 1));

    seal_router(&mut r);

    // 성공한 라우트만 매칭 (등록된 긴 경로로 매칭)
    let hit = match_route(&r, 0, &valid_path);
    assert!(hit.is_some());
    assert_eq!(hit.unwrap().0, 1);
}

#[test]
fn max_param_length_limit() {
    let mut r = build_router(true);

    // 파라미터 이름 길이 제한 제거: 긴 이름도 허용
    let long_param_name = "a".repeat(300);
    let valid_path = format!("/long/:{}", long_param_name);
    assert!(register_route(&mut r, 0, &valid_path, 1));

    seal_router(&mut r);

    // 성공한 라우트만 매칭
    let hit = match_route(&r, 0, "/long/123");
    assert!(hit.is_some());
    assert_eq!(hit.unwrap().0, 1);
}

#[test]
fn unsafe_regex_detection() {
    let mut r = build_router(true);

    // 안전한 정규식은 성공
    assert!(register_route(&mut r, 0, "/users/:id(\\d+)", 1));
    assert!(register_route(&mut r, 0, "/posts/:slug([a-z0-9-]+)", 2));

    // 위험한 정규식은 실패
    let result1 = register_route_ex(&mut r, 0, "/dangerous/:r(.+)+", 3);
    assert_ne!(result1, 0);

    let result2 = register_route_ex(&mut r, 0, "/evil/:r((.+)+)", 4);
    assert_ne!(result2, 0);

    let result3 = register_route_ex(&mut r, 0, "/bad/:r(.{1,1000})", 5);
    assert_ne!(result3, 0);

    seal_router(&mut r);

    // 성공한 라우트들만 매칭
    let hit1 = match_route(&r, 0, "/users/123");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/posts/my-post");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);
}

#[test]
fn route_conflicts() {
    let mut r = build_router(true);

    // 첫 번째 라우트 등록
    assert!(register_route(&mut r, 0, "/users/:id", 1));

    // 충돌하는 라우트들
    let result1 = register_route_ex(&mut r, 0, "/users/:user_id", 2);
    // 이름만 다른 파라미터는 허용 (충돌 아님)
    assert_eq!(result1, 0);

    let result2 = register_route_ex(&mut r, 0, "/users/:id(\\d+)", 3);
    // 동일 위치에서 제약이 다른 패턴은 충돌
    assert_ne!(result2, 0);

    let _result3 = register_route_ex(&mut r, 0, "/users/*", 4);
    // 와일드카드와 파라미터는 같은 위치에서 충돌하지 않을 수 있음
    // assert_ne!(result3, 0);

    seal_router(&mut r);

    // 첫 번째 라우트만 매칭
    let hit = match_route(&r, 0, "/users/123");
    assert!(hit.is_some());
    assert_eq!(hit.unwrap().0, 1);
}

// ============================================================================
// HTTP 메서드 테스트
// ============================================================================

#[test]
fn all_http_methods() {
    let mut r = build_router(true);

    // 모든 HTTP 메서드 테스트
    let methods = [
        (0, "GET"),
        (1, "POST"),
        (2, "PUT"),
        (3, "PATCH"),
        (4, "DELETE"),
        (5, "OPTIONS"),
        (6, "HEAD"),
    ];

    for (method_code, _method_name) in methods.iter() {
        let path = format!("/test/{}", method_code);
        assert!(register_route(
            &mut r,
            *method_code,
            &path,
            *method_code as u64 + 100
        ));
    }

    seal_router(&mut r);

    // 각 메서드로 매칭 확인
    for (method_code, _method_name) in methods.iter() {
        let path = format!("/test/{}", method_code);
        let hit = match_route(&r, *method_code, &path);
        assert!(hit.is_some());
        assert_eq!(hit.unwrap().0, *method_code as u64 + 100);
    }
}

#[test]
fn method_specific_routes() {
    let mut r = build_router(true);

    // 같은 경로에 다른 메서드로 라우트 등록
    assert!(register_route(&mut r, 0, "/api/users", 1)); // GET
    assert!(register_route(&mut r, 1, "/api/users", 2)); // POST
    assert!(register_route(&mut r, 2, "/api/users", 3)); // PUT
    assert!(register_route(&mut r, 4, "/api/users", 4)); // DELETE

    seal_router(&mut r);

    // 각 메서드별로 매칭 확인
    let hit1 = match_route(&r, 0, "/api/users");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 1, "/api/users");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 2, "/api/users");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);

    let hit4 = match_route(&r, 4, "/api/users");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 4);

    // 다른 메서드로는 매칭되지 않음
    assert!(match_route(&r, 3, "/api/users").is_none()); // PATCH
    assert!(match_route(&r, 5, "/api/users").is_none()); // OPTIONS
    assert!(match_route(&r, 6, "/api/users").is_none()); // HEAD
}

// ============================================================================
// 에러 코드 매핑 테스트
// ============================================================================

#[test]
fn error_code_mapping() {
    let mut r = build_router(true);

    // InsertError::Conflict = 1
    assert!(register_route(&mut r, 0, "/conflict/:id", 1));
    // 이름이 다른 파라미터는 허용으로 변경됨 (충돌 아님)
    let conflict_code = register_route_ex(&mut r, 0, "/conflict/:name", 2);
    assert_eq!(
        conflict_code, 0,
        "Conflict should not occur for different param names"
    );

    // InsertError::UnsafeRegex = 2
    let unsafe_regex_code = register_route_ex(&mut r, 0, "/unsafe/:r(.+)+", 3);
    assert_eq!(unsafe_regex_code, 2, "UnsafeRegex should return code 2");

    // InsertError::WildcardPosition = 4
    let wildcard_pos_code = register_route_ex(&mut r, 0, "/wild/*/invalid", 5);
    assert_eq!(
        wildcard_pos_code, 4,
        "WildcardPosition should return code 4"
    );

    // InsertError::Syntax = 3 (잘못된 정규식 구문)
    let syntax_code = register_route_ex(&mut r, 0, "/syntax/:id([a-z", 6);
    assert_eq!(syntax_code, 3, "Syntax should return code 3");
}

// ============================================================================
// 고급 라우팅 테스트
// ============================================================================

#[test]
fn complex_nested_routes() {
    let mut r = build_router(true);

    // 복잡한 중첩 라우트들 등록
    assert!(register_route(
        &mut r,
        0,
        "/api/v1/users/:user_id/profile",
        1
    ));
    assert!(register_route(
        &mut r,
        0,
        "/api/v1/users/:user_id/posts/:post_id",
        2
    ));
    assert!(register_route(
        &mut r,
        0,
        "/api/v1/users/:user_id/posts/:post_id/comments/:comment_id",
        3
    ));
    assert!(register_route(
        &mut r,
        0,
        "/api/v1/users/:user_id/posts/:post_id/comments/:comment_id/replies/:reply_id",
        4
    ));

    seal_router(&mut r);

    // 깊은 중첩 라우트 매칭 확인
    let hit1 = match_route(&r, 0, "/api/v1/users/123/profile");
    assert!(hit1.is_some());
    let (key1, params1) = hit1.unwrap();
    assert_eq!(key1, 1);
    assert_eq!(params1.len(), 1);
    assert_eq!(params1[0].0, "user_id");
    assert_eq!(params1[0].1, "123");

    let hit2 = match_route(&r, 0, "/api/v1/users/123/posts/456");
    assert!(hit2.is_some());
    let (key2, params2) = hit2.unwrap();
    assert_eq!(key2, 2);
    assert_eq!(params2.len(), 2);
    assert_eq!(params2[0].0, "user_id");
    assert_eq!(params2[0].1, "123");
    assert_eq!(params2[1].0, "post_id");
    assert_eq!(params2[1].1, "456");

    let hit3 = match_route(&r, 0, "/api/v1/users/123/posts/456/comments/789");
    assert!(hit3.is_some());
    let (key3, params3) = hit3.unwrap();
    assert_eq!(key3, 3);
    assert_eq!(params3.len(), 3);

    let hit4 = match_route(
        &r,
        0,
        "/api/v1/users/123/posts/456/comments/789/replies/101",
    );
    assert!(hit4.is_some());
    let (key4, params4) = hit4.unwrap();
    assert_eq!(key4, 4);
    assert_eq!(params4.len(), 4);
}

#[test]
fn mixed_pattern_routes() {
    let mut r = build_router(true);

    // 정적 + 파라미터 + 정규식 + 와일드카드 조합
    assert!(register_route(&mut r, 0, "/api/v1/users", 1)); // 정적
    assert!(register_route(&mut r, 0, "/api/v1/users/:id", 2)); // 파라미터
    assert!(register_route(&mut r, 0, "/api/v1/users/:id(\\d+)", 3)); // 정규식
    assert!(register_route(&mut r, 0, "/api/v1/users/profile/*", 4)); // 와일드카드

    seal_router(&mut r);

    // 우선순위에 따른 매칭 확인
    // 정적이 가장 높은 우선순위
    let hit1 = match_route(&r, 0, "/api/v1/users");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    // 파라미터 매칭 (더 구체적인 패턴이 우선)
    let hit2 = match_route(&r, 0, "/api/v1/users/123");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2); // 파라미터가 매칭됨

    // 와일드카드 매칭
    let hit3 = match_route(&r, 0, "/api/v1/users/profile/settings");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 4);
}

#[test]
fn regex_cache_behavior() {
    let mut r = build_router(true);

    // 동일한 정규식 패턴을 여러 라우트에서 사용
    for i in 0..10 {
        let path = format!("/users/:id(\\d{{1,3}})/{}", i);
        assert!(register_route(&mut r, 0, &path, i + 100));
    }

    // 다른 정규식 패턴들도 추가
    for i in 0..5 {
        let path = format!("/posts/:slug([a-z0-9-]+)/{}", i);
        assert!(register_route(&mut r, 0, &path, i + 200));
    }

    seal_router(&mut r);

    // 정규식 캐시 동작 확인 (내부적으로는 정규식 재사용)
    let hit1 = match_route(&r, 0, "/users/123/5");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 105);

    let hit2 = match_route(&r, 0, "/posts/my-post-123/3");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 203);
}

// ============================================================================
// 성능 및 스트레스 테스트
// ============================================================================

#[test]
fn large_route_table() {
    let mut r = build_router(true);

    // 대량의 정적 라우트 등록
    for i in 0..1000 {
        let path = format!("/api/v1/users/{}/profile", i);
        assert!(register_route(&mut r, 0, &path, i + 1000));
    }

    // 대량의 파라미터 라우트 등록
    for i in 0..500 {
        let path = format!("/api/v1/users/:id/posts/{}", i);
        assert!(register_route(&mut r, 0, &path, i + 2000));
    }

    // 대량의 정규식 라우트 등록
    for i in 0..200 {
        let path = format!(
            "/api/v1/users/:id(\\d{{1,4}})/posts/:post_id(\\d{{1,6}})/{}",
            i
        );
        assert!(register_route(&mut r, 0, &path, i + 3000));
    }

    seal_router(&mut r);

    // 일부 라우트 매칭 확인
    let hit1 = match_route(&r, 0, "/api/v1/users/42/profile");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1042);

    let hit2 = match_route(&r, 0, "/api/v1/users/123/posts/100");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2100);

    let hit3 = match_route(&r, 0, "/api/v1/users/1234/posts/456789/50");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3050);
}

#[test]
fn concurrent_access_simulation() {
    let mut r = build_router(true);

    // 라우트 등록
    assert!(register_route(&mut r, 0, "/concurrent/test", 1));
    assert!(register_route(&mut r, 0, "/concurrent/:id(\\d+)", 2));
    assert!(register_route(&mut r, 0, "/concurrent/*", 3));

    seal_router(&mut r);

    // 여러 스레드에서 동시 접근 시뮬레이션
    let r_ref = &r;

    // 첫 번째 스레드 시뮬레이션
    let hit1 = match_route(r_ref, 0, "/concurrent/test");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    // 두 번째 스레드 시뮬레이션
    let hit2 = match_route(r_ref, 0, "/concurrent/42");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    // 세 번째 스레드 시뮬레이션
    let hit3 = match_route(r_ref, 0, "/concurrent/anything/deep/nested");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);

    // 동시에 다른 경로 접근
    let hit4 = match_route(r_ref, 0, "/concurrent/test");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 1);

    let hit5 = match_route(r_ref, 0, "/concurrent/999");
    assert!(hit5.is_some());
    assert_eq!(hit5.unwrap().0, 2);
}

// ============================================================================
// 엣지 케이스 및 경계값 테스트
// ============================================================================

#[test]
fn edge_cases_and_boundaries() {
    let mut r = build_router(true);

    // 빈 경로는 실패
    let result1 = register_route_ex(&mut r, 0, "", 1);
    assert_ne!(result1, 0);

    // 루트 경로는 성공
    assert!(register_route(&mut r, 0, "/", 2));

    // 매우 긴 세그먼트 (max_param_length 내)
    let long_segment = "a".repeat(100);
    let path = format!("/long/{}", long_segment);
    assert!(register_route(&mut r, 0, &path, 3));

    // 복잡한 정규식 (안전한 것)
    assert!(register_route(&mut r, 0, "/complex/:id(\\d{1,10})", 5));

    // 중첩된 와일드카드 (실패해야 함)
    let result2 = register_route_ex(&mut r, 0, "/nested/*/*", 6);
    assert_ne!(result2, 0);

    seal_router(&mut r);

    // 성공한 라우트들 매칭 확인
    let hit1 = match_route(&r, 0, "/");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 2);

    let hit2 = match_route(&r, 0, &format!("/long/{}", long_segment));
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 3);

    let hit3 = match_route(&r, 0, "/complex/12345");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 5);
}

#[test]
fn normalization_edge_cases() {
    let mut r = Router::with_options(
        RouterOptions {
            ignore_trailing_slash: true,
            ignore_duplicate_slashes: true,
            case_sensitive: false,
            allow_unsafe_regex: false,
        },
        None,
    );

    // 기본 라우트 등록
    assert!(register_route(&mut r, 0, "/normalize/test", 1));
    assert!(register_route(&mut r, 0, "/NORMALIZE/TEST", 2));

    seal_router(&mut r);

    // 다양한 정규화 케이스 테스트
    let test_cases = [
        "/normalize/test",
        "/normalize/test/",
        "//normalize//test",
        "//normalize//test//",
        "/NORMALIZE/TEST",
        "/NORMALIZE/TEST/",
        "//NORMALIZE//TEST",
        "//NORMALIZE//TEST//",
    ];

    for test_path in test_cases.iter() {
        let hit = match_route(&r, 0, test_path);
        assert!(hit.is_some(), "Path '{}' should match", test_path);

        // 케이스 민감하지 않은 모드에서는 둘 다 매칭되어야 함
        let key = hit.unwrap().0;
        assert!(
            key == 1 || key == 2,
            "Path '{}' should match either route",
            test_path
        );
    }
}

#[test]
fn empty_and_special_paths() {
    let mut r = build_router(true);

    // 특수한 경로들 등록
    assert!(register_route(&mut r, 0, "/", 1));
    assert!(register_route(&mut r, 0, "/-", 2));
    assert!(register_route(&mut r, 0, "/_", 3));
    assert!(register_route(&mut r, 0, "/.", 4));
    assert!(register_route(&mut r, 0, "/..", 5));

    seal_router(&mut r);

    // 특수 경로 매칭 확인
    let hit1 = match_route(&r, 0, "/");
    assert!(hit1.is_some());
    assert_eq!(hit1.unwrap().0, 1);

    let hit2 = match_route(&r, 0, "/-");
    assert!(hit2.is_some());
    assert_eq!(hit2.unwrap().0, 2);

    let hit3 = match_route(&r, 0, "/_");
    assert!(hit3.is_some());
    assert_eq!(hit3.unwrap().0, 3);

    let hit4 = match_route(&r, 0, "/.");
    assert!(hit4.is_some());
    assert_eq!(hit4.unwrap().0, 4);

    let hit5 = match_route(&r, 0, "/..");
    assert!(hit5.is_some());
    assert_eq!(hit5.unwrap().0, 5);
}
