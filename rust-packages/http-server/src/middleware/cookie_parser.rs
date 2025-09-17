use serde_json::json;

use crate::middleware::chain::Middleware;
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};

pub struct CookieParser;

impl Middleware for CookieParser {
    #[tracing::instrument(level = "trace", skip(self, req, _res, _payload))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        _payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation = "cookie_parser");
        if let Some(c) = req.headers.get("cookie").cloned() {
            let map: std::collections::HashMap<String, String> = parse_cookies(&c);

            req.cookies = json!(map);
        }

        true
    }
}

// RFC 6265 준수 쿠키 파싱 함수
fn parse_cookies(cookie_header: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let mut chars = cookie_header.chars().peekable();
    let mut current_name = String::new();
    let mut current_value = String::new();
    let mut in_name = true;
    let mut in_quotes = false;
    let mut escaped = false;

    while let Some(ch) = chars.next() {
        match ch {
            '=' if in_name && !in_quotes => {
                in_name = false;
            }
            ';' if !in_quotes => {
                // 쿠키 구분자 - RFC 6265 준수
                if !current_name.is_empty() {
                    let name = current_name.trim().to_string();
                    let value = current_value.trim().to_string();
                    let processed_value =
                        if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                            // 따옴표 제거 및 이스케이프 처리
                            let inner = &value[1..value.len() - 1];
                            inner.replace("\\\"", "\"").replace("\\\\", "\\")
                        } else {
                            value
                        };
                    map.insert(name, processed_value);
                }
                current_name.clear();
                current_value.clear();
                in_name = true;
                in_quotes = false;
                escaped = false;
                // 공백 건너뛰기
                while let Some(&' ') = chars.peek() {
                    chars.next();
                }
            }
            '"' if !in_name && !escaped => {
                in_quotes = !in_quotes;
                current_value.push(ch);
            }
            '\\' if in_quotes => {
                escaped = !escaped;
                current_value.push(ch);
            }
            _ => {
                if in_name {
                    current_name.push(ch);
                } else {
                    current_value.push(ch);
                }
                escaped = false;
            }
        }
    }

    // 마지막 쿠키 처리
    if !current_name.is_empty() {
        let name = current_name.trim().to_string();
        let value = current_value.trim().to_string();
        let processed_value = if value.starts_with('"') && value.ends_with('"') && value.len() >= 2
        {
            let inner = &value[1..value.len() - 1];
            inner.replace("\\\"", "\"").replace("\\\\", "\\")
        } else {
            value
        };
        map.insert(name, processed_value);
    }

    map
}
