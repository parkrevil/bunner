use crate::enums::HttpStatusCode;
use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use std::sync::OnceLock;
use url::Url;
use uriparse::URI;
use serde_qs::Config as QsConfig;

static QS_CONFIG: OnceLock<serde_qs::Config> = OnceLock::new();

pub struct UrlParser;

impl UrlParser {
    /// 헬퍼 함수: 요청 거부 응답 생성
    fn reject_request(res: &mut BunnerResponse, status: HttpStatusCode, _message: &str) -> bool {
        res.http_status = status;
        res.body = serde_json::Value::String(status.reason_phrase().to_string());
        false
    }

    /// RFC 3986 준수 URL 검증 (uriparse 사용)
    fn validate_rfc3986_url(url_str: &str) -> Result<(), &'static str> {
        match URI::try_from(url_str) {
            Ok(uri) => {
                // RFC 3986 구조 검증 - uriparse에서는 scheme()이 &Scheme을 반환하므로 as_str()로 확인
                let scheme = uri.scheme();
                if scheme.as_str().is_empty() {
                    return Err("Missing URL scheme");
                }

                // 쿼리 컴포넌트 검증
                if let Some(query) = uri.query() {
                    Self::validate_rfc3986_query(query)?;
                }

                Ok(())
            }
            Err(_) => Err("Invalid RFC 3986 URL format"),
        }
    }

    /// RFC 3986 + WHATWG 기반 쿼리 검증 (라이브러리 미사용)
    ///
    /// 검증 규칙:
    /// - 모든 `%`는 두 자리의 16진수로 이어져야 함 (대/소문자 허용)
    /// - 퍼센트 디코딩 결과는 UTF-8이어야 함 (WHATWG는 UTF-8 사용)
    /// - 쿼리 내 비인쇄 ASCII(0x00..0x1F, 0x7F), 공백, `#`는 raw로 허용하지 않음 (인코딩 필요)
    /// - 비-ASCII 문자는 raw로 허용하지 않음 (인코딩 필요)
    /// - 나머지 ASCII는 허용 (일반적으로 unreserved/sub-delims/":"/"@"/"/"/"?"/"["/"]")
    fn validate_rfc3986_query(query: &str) -> Result<(), &'static str> {
        fn is_hex(b: u8) -> bool {
            (b'0'..=b'9').contains(&b) || (b'a'..=b'f').contains(&b) || (b'A'..=b'F').contains(&b)
        }

        let qb = query.as_bytes();
        let mut i = 0usize;
        let mut decoded: Vec<u8> = Vec::with_capacity(qb.len());

        while i < qb.len() {
            let b = qb[i];
            if b == b'%' {
                if i + 2 >= qb.len() {
                    return Err("Invalid percent encoding in query");
                }
                let h1 = qb[i + 1];
                let h2 = qb[i + 2];
                if !is_hex(h1) || !is_hex(h2) {
                    return Err("Invalid percent encoding in query");
                }
                let v = ((h1 as char).to_digit(16).unwrap() as u8) << 4
                    | (h2 as char).to_digit(16).unwrap() as u8;
                decoded.push(v);
                i += 3;
                continue;
            }

            // raw 비허용 문자 체크 (WHATWG 권장)
            // - C0 제어문자 및 DEL
            if b <= 0x1F || b == 0x7F {
                return Err("Control characters not allowed in query");
            }
            // - 공백과 fragment 구분자인 # 는 raw 금지 (반드시 인코딩)
            if b == b' ' || b == b'#' {
                return Err("Space or # must be percent-encoded in query");
            }
            // - 비 ASCII는 raw 금지 (반드시 인코딩)
            if b >= 0x80 {
                return Err("Non-ASCII bytes must be percent-encoded in query");
            }

            // 나머지 ASCII는 허용 (실제 브라우저/WHATWG가 허용하는 쿼리 문자 집합과 정합)
            decoded.push(b);
            i += 1;
        }

        // UTF-8 유효성 검증
        if std::str::from_utf8(&decoded).is_err() {
            return Err("Invalid UTF-8 in query");
        }
        Ok(())
    }

    /// WHATWG URL 표준 준수 쿼리 파싱 (urlencoding 사용)
    fn parse_whatwg_query(query: &str) -> Result<std::collections::HashMap<String, String>, &'static str> {
        let mut params = std::collections::HashMap::new();

        for pair in query.split('&') {
            if pair.is_empty() {
                continue;
            }

            if let Some(eq_pos) = pair.find('=') {
                let key = &pair[..eq_pos];
                let value = &pair[eq_pos + 1..];

                // urlencoding을 사용한 디코딩
                let decoded_key = urlencoding::decode(key)
                    .map_err(|_| "Invalid encoding in key")?;
                let decoded_value = urlencoding::decode(value)
                    .map_err(|_| "Invalid encoding in value")?;

                params.insert(decoded_key.into_owned(), decoded_value.into_owned());
            } else {
                // 값이 없는 파라미터
                let decoded_key = urlencoding::decode(pair)
                    .map_err(|_| "Invalid encoding in key")?;
                params.insert(decoded_key.into_owned(), String::new());
            }
        }

        Ok(params)
    }

    /// 엄격한 malformed 브래킷 검증
    fn validate_malformed_brackets(query: &str) -> Result<(), &'static str> {
        // 허용 패턴 예시:
        // - a=b
        // - arr[]=1&arr[]=2
        // - obj[key]=value
        // - deep[a][b][c]=v
        // 금지:
        // - [k]=v (리드 브래킷)
        // - []=v (키 없음)
        // - a[=v (닫히지 않음)
        // - a[[x]]=v (중첩 여는 괄호)
        // - a[]]=v (닫는 괄호 초과)

        let mut open = 0i32;
        let mut saw_key_char_before_bracket = false;
        for ch in query.chars() {
            match ch {
                '[' => {
                    if open == 0 && !saw_key_char_before_bracket {
                        // 쿼리 세그먼트 시작이 '[' 이면 금지: [k]=v, []=v
                        return Err("Leading bracket without key");
                    }
                    open += 1;
                }
                ']' => {
                    if open <= 0 {
                        return Err("Unmatched closing bracket");
                    }
                    open -= 1;
                }
                '&' | '=' => {
                    // 세그먼트 구분 시 상태 초기화
                    if ch == '&' {
                        if open != 0 {
                            return Err("Unclosed bracket before parameter separator");
                        }
                        saw_key_char_before_bracket = false;
                    }
                }
                _ => {
                    if open == 0 {
                        // 키 문자열 내 일반 문자 관측
                        saw_key_char_before_bracket = true;
                    }
                }
            }
        }

        if open != 0 {
            return Err("Unclosed bracket at end");
        }
        Ok(())
    }

    /// 쿼리 보안 검증
    fn validate_query_security(query: &str) -> Result<(), &'static str> {
        // 경로 traversal 공격 방지
        if query.contains("..") {
            return Err("Path traversal detected");
        }

        // 디렉터리 구분자 공격 방지
        if query.contains('/') || query.contains('\\') {
            return Err("Directory separators in query");
        }

        // 스크립트 인젝션 패턴 방지
        let suspicious_patterns = ["<script", "javascript:", "data:", "vbscript:"];
        for pattern in &suspicious_patterns {
            if query.to_lowercase().contains(pattern) {
                return Err("Suspicious script pattern detected");
            }
        }

        // SQL 인젝션 기본 패턴 방지
        let sql_patterns = ["'", "\"", ";", "--", "/*", "*/", "union", "select"];
        for pattern in &sql_patterns {
            if query.to_lowercase().contains(pattern) {
                return Err("Potential SQL injection pattern");
            }
        }

        Ok(())
    }

    /// 개별 파라미터 검증
    fn validate_parameter(key: &str, value: &str) -> Result<(), &'static str> {
        // 제어 문자 검증 (탭, LF, CR 제외)
        for c in key.chars().chain(value.chars()) {
            if c.is_control() && !matches!(c, '\t' | '\n' | '\r') {
                return Err("Control characters not allowed");
            }
        }

        // 추가적인 키 검증
        if key.chars().any(|c| !c.is_ascii_alphanumeric() && !matches!(c, '-' | '_' | '.')) {
            // 더 엄격한 키 검증 - 영숫자와 일부 특수문자만 허용
            let allowed_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";
            if !key.chars().all(|c| allowed_chars.contains(c)) {
                return Err("Invalid characters in parameter key");
            }
        }

        Ok(())
    }

    /// IRI (RFC 3987) 지원을 위한 유니코드 도메인 검증 강화
    fn has_valid_international_domain_enhanced(url_str: &str) -> Result<(), &'static str> {
        if let Some(domain_start) = url_str.find("://") {
            let after_scheme = &url_str[domain_start + 3..];
            let domain = if let Some(domain_end) = after_scheme.find('/') {
                &after_scheme[..domain_end]
            } else if let Some(domain_end) = after_scheme.find('?') {
                &after_scheme[..domain_end]
            } else if let Some(domain_end) = after_scheme.find('#') {
                &after_scheme[..domain_end]
            } else {
                after_scheme
            };

            // IRI에서는 유니코드가 허용되지만, 보안상 ASCII만 허용
            if !domain.is_ascii() {
                return Err("Non-ASCII domain names not supported for security");
            }

            // 도메인 길이 제한
            if domain.len() > 253 {
                return Err("Domain name too long");
            }

            // 기본 도메인 구조 검증
            if domain.is_empty() || domain.starts_with('.') || domain.ends_with('.') {
                return Err("Invalid domain structure");
            }

            // 라벨별 검증
            for label in domain.split('.') {
                if label.is_empty() || label.len() > 63 {
                    return Err("Invalid domain label");
                }
                // 하이픈으로 시작하거나 끝나는 라벨 거부
                if label.starts_with('-') || label.ends_with('-') {
                    return Err("Domain label cannot start or end with hyphen");
                }
            }

            Ok(())
        } else {
            Err("Invalid URL scheme")
        }
    }
}

impl Middleware for UrlParser {
    #[tracing::instrument(level = "trace", skip(self, req, res, payload), fields(url=%payload.url))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation="url_parser", url=%payload.url);

        // IRI 지원을 위한 국제 도메인 검증
        if let Err(e) = Self::has_valid_international_domain_enhanced(&payload.url) {
            tracing::event!(
                tracing::Level::TRACE,
                operation = "url_parser_reject",
                reason = "invalid_international_domain",
                error = %e
            );
            return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid domain");
        }

        let u = match Url::parse(payload.url.as_str()) {
            Ok(u) => u,
            Err(_) => {
                res.http_status = HttpStatusCode::BadRequest;
                res.body = serde_json::Value::String(
                    HttpStatusCode::BadRequest.reason_phrase().to_string(),
                );
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "url_parse_error"
                );
                return false;
            }
        };

        req.path = u.path().to_string();

        if let Some(q) = u.query() {
            // 1단계: RFC 3986 검증
            if let Err(e) = Self::validate_rfc3986_query(q) {
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "rfc3986_validation_error",
                    error = %e
                );
                return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid RFC 3986 query");
            }

            // 2단계: malformed 브래킷 검증 - 각 파라미터별로 검증
            for pair in q.split('&') {
                if pair.is_empty() {
                    continue;
                }

                if let Some(eq_pos) = pair.find('=') {
                    let key = &pair[..eq_pos];
                    let value = &pair[eq_pos + 1..];

                    // key와 value를 개별적으로 검증
                    if let Err(e) = Self::validate_malformed_brackets(key) {
                        tracing::event!(
                            tracing::Level::TRACE,
                            operation = "url_parser_reject",
                            reason = "malformed_brackets_in_key",
                            key = %key,
                            error = %e
                        );
                        return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid bracket syntax in key");
                    }

                    if let Err(e) = Self::validate_malformed_brackets(value) {
                        tracing::event!(
                            tracing::Level::TRACE,
                            operation = "url_parser_reject",
                            reason = "malformed_brackets_in_value",
                            value = %value,
                            error = %e
                        );
                        return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid bracket syntax in value");
                    }
                } else {
                    // 값이 없는 파라미터도 key 검증
                    if let Err(e) = Self::validate_malformed_brackets(pair) {
                        tracing::event!(
                            tracing::Level::TRACE,
                            operation = "url_parser_reject",
                            reason = "malformed_brackets_in_key",
                            key = %pair,
                            error = %e
                        );
                        return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid bracket syntax in key");
                    }
                }
            }

            // 3단계: 보안 검증
            if let Err(e) = Self::validate_query_security(q) {
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "query_security_error",
                    error = %e
                );
                return Self::reject_request(res, HttpStatusCode::BadRequest, "Query security violation");
            }

            // 4단계: WHATWG 준수 파싱 + serde_qs
            let config = QS_CONFIG.get_or_init(|| {
                QsConfig::new(32, false)
            });

            match config.deserialize_str::<std::collections::HashMap<String, serde_json::Value>>(q) {
                Ok(map) => {
                    // 중복 non-array key 방지: 동일 키가 여러 값일 때 배열([]) 표기 없이 들어오면 거부
                    // 접근: 원본 쿼리를 스캔하여 동일 원시 키가 여러 번 등장했는지 확인하고,
                    // 해당 키가 배열 표기([])를 사용하지 않았으면 거부
                    let mut key_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
                    for pair in q.split('&') {
                        if pair.is_empty() { continue; }
                        let (raw_key, _raw_val) = pair.split_once('=').unwrap_or((pair, ""));
                        // [] 접미사 제거 전 원시 키 추출 (tags[] -> tags)
                        let normalized = if raw_key.ends_with("[]") { &raw_key[..raw_key.len()-2] } else { raw_key };
                        // 중첩 키는 최상위 키만 추출: a[b][c] -> a
                        let top = normalized.split('[').next().unwrap_or(normalized);
                        *key_counts.entry(top.to_string()).or_default() += 1;
                    }

                    let mut obj = serde_json::Map::new();
                    for (k, v) in map {
                        // 최종 파라미터 검증
                        if let Err(e) = Self::validate_parameter(&k, &v.as_str().unwrap_or("")) {
                            tracing::event!(
                                tracing::Level::TRACE,
                                operation = "url_parser_reject",
                                reason = "parameter_validation_error",
                                key = %k,
                                error = %e
                            );
                            return Self::reject_request(res, HttpStatusCode::BadRequest, "Invalid parameter");
                        }
                        // 중복 non-array 키 거부 로직 적용
                        let top = k.split('[').next().unwrap_or(&k);
                        let count = key_counts.get(top).copied().unwrap_or(1);
                        let is_arrayish = k.contains("[]") || v.is_array();
                        if count > 1 && !is_arrayish {
                            tracing::event!(
                                tracing::Level::TRACE,
                                operation = "url_parser_reject",
                                reason = "duplicate_non_array_key",
                                key = %k,
                                occurrences = count
                            );
                            return Self::reject_request(res, HttpStatusCode::BadRequest, "Duplicate non-array key");
                        }

                        obj.insert(k, v);
                    }
                    req.query_params = Some(serde_json::Value::Object(obj));
                }
                Err(e) => {
                    tracing::event!(
                        tracing::Level::TRACE,
                        operation = "url_parser_qs_error",
                        query = %q,
                        error = %e
                    );
                    return Self::reject_request(res, HttpStatusCode::BadRequest, "Query parsing failed");
                }
            }
        }

        true
    }
}
