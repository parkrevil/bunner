use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};

use super::Middleware;

pub struct HeaderParser;

impl Middleware for HeaderParser {
    #[tracing::instrument(level = "trace", skip(self, req, _res, payload), fields(ct=payload.headers.get("content-type").map(|s| s.as_str()).unwrap_or("")))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation = "header_parser");
        // keep as HashMap to avoid JSON conversion cost on hot path
        req.headers = payload.headers.clone();

        // content-type and charset - RFC 7231 준수 파싱
        if let Some(ct) = payload.headers.get("content-type") {
            let ct = ct.trim();
            if ct.is_empty() {
                return true;
            }

            match parse_content_type(ct) {
                Ok((media_type, parameters)) => {
                    req.content_type = Some(media_type);

                    // charset 파라미터 추출
                    if let Some(charset) = parameters.get("charset") {
                        req.charset = Some(charset.clone());
                    }
                }
                Err(_) => {
                    // 잘못된 content-type은 원래 값으로 설정 (RFC 7231 준수)
                    tracing::event!(
                        tracing::Level::TRACE,
                        operation = "header_parser",
                        warning = "invalid_content_type",
                        value = ct
                    );
                    req.content_type = Some(ct.to_string());
                }
            }
        }

        if let Some(ct) = payload.headers.get("content-length") {
            req.content_length = Some(ct.parse::<u64>().unwrap_or(0));
        }

        true
    }
}

// RFC 7231 준수 content-type 파싱 함수
fn parse_content_type(
    content_type: &str,
) -> Result<(String, std::collections::HashMap<String, String>), &'static str> {
    let content_type = content_type.trim();

    if content_type.is_empty() {
        return Err("empty content-type");
    }

    // 미디어 타입과 파라미터 분리
    let mut parts = content_type.splitn(2, ';');
    let media_type = parts.next().unwrap().trim().to_lowercase();

    if media_type.is_empty() {
        return Err("empty media type");
    }

    let mut parameters = std::collections::HashMap::new();

    if let Some(params_str) = parts.next() {
        for param in params_str.split(';') {
            let param = param.trim();
            if param.is_empty() {
                continue;
            }

            let mut kv = param.splitn(2, '=');
            let key = kv
                .next()
                .map(|s| s.trim().to_lowercase())
                .ok_or("invalid parameter format")?;

            let value = kv
                .next()
                .map(|s| s.trim().trim_matches('"'))
                .unwrap_or("")
                .to_string();

            if !key.is_empty() && !parameters.contains_key(&key) {
                // 중복 파라미터는 첫 번째 것만 사용 (RFC 7231 준수)
                parameters.insert(key, value);
            }
        }
    }

    Ok((media_type, parameters))
}
