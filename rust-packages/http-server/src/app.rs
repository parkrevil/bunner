use crate::enums::{HttpMethod, LenPrefixedString};
use crate::errors::{HttpServerError, HttpServerErrorCode};
use crate::helpers::callback_handle_request;
use crate::middleware::{BodyParser, Chain, CookieParser, HeaderParser, UrlParser};
use crate::router::{Router, RouterReadOnly};
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestOutput, HandleRequestPayload};
use crate::thread_pool::submit_job;
use crate::types::RequestKey;

use super::HandleRequestCallback;

use percent_encoding::percent_decode_str;
use serde_json::Value as JsonValue;
use std::{str, sync::Arc};
use uuid::Uuid;

#[repr(C)]
pub struct App {
    router: Router,
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}

impl App {
    pub fn new() -> Self {
        App {
            router: Router::new(None),
        }
    }

    pub fn add_route(
        &self,
        method: HttpMethod,
        path: &str,
    ) -> crate::router::structures::RouterResult<u16> {
        self.router.add(method, path)
    }

    pub fn add_routes(
        &self,
        routes: Vec<(HttpMethod, String)>,
    ) -> crate::router::structures::RouterResult<Vec<u16>> {
        self.router.add_bulk(routes)
    }

    pub fn seal_routes(&self) {
        self.router.seal();
    }

    pub fn handle_request(
        &self,
        cb: HandleRequestCallback,
        request_key: RequestKey,
        payload: LenPrefixedString,
    ) {
        let ro = match self.router.get_readonly() {
            Ok(r) => r,
            Err(e) => {
                callback_handle_request(cb, request_key, None, &HttpServerError::from(e));

                return;
            }
        };

        match submit_job(Box::new(move || {
            process_request(cb, request_key, payload, ro);
        })) {
            Ok(()) => {
                tracing::trace!("request enqueued");
            }
            Err(_e) => {
                tracing::warn!(
                    reason = "queue_full",
                    "Failed to enqueue request; queue may be full"
                );

                let err = HttpServerError::new(
                    HttpServerErrorCode::QueueFull,
                    "thread_pool",
                    "enqueue",
                    "backpressure",
                    "Request queue is full".to_string(),
                    None,
                );

                callback_handle_request(cb, request_key, None, &err);
            }
        }
    }
}

fn process_request(
    cb: HandleRequestCallback,
    request_key: RequestKey,
    payload_str: LenPrefixedString,
    ro: Arc<RouterReadOnly>,
) {
    use crate::utils::json::deserialize;

    let payload_str_ref = match &payload_str {
        LenPrefixedString::Text(s) => s.as_str(),
        LenPrefixedString::Bytes(b) => unsafe { std::str::from_utf8_unchecked(b) },
    };
    let payload = match deserialize::<HandleRequestPayload>(payload_str_ref) {
        Ok(p) => p,
        Err(_) => {
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "app",
                "process_request",
                "parsing",
                "Failed to deserialize request payload JSON".to_string(),
                Some(serde_json::json!({"requestKey": request_key})),
            );

            tracing::event!(tracing::Level::ERROR, reason="deserialize_payload_error", request_key=%request_key);

            callback_handle_request(cb, request_key, None, &err);

            return;
        }
    };
    let http_method = match HttpMethod::from_u8(payload.http_method) {
        Ok(m) => m,
        Err(e) => {
            let bunner_error = HttpServerError::new(
                e,
                "app",
                "process_request",
                "validation",
                "Invalid HTTP method in request payload".to_string(),
                Some(
                    serde_json::json!({"requestKey": request_key, "httpMethod": payload.http_method}),
                ),
            );

            callback_handle_request(cb, request_key, None, &bunner_error);

            return;
        }
    };
    let mut request = BunnerRequest {
        url: payload.url.clone(),
        http_method,
        path: String::new(),
        headers: payload.headers.clone(),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: None,
        content_length: None,
        charset: None,
        params: None,
        query_params: None,
        body: None,
    };
    let mut response = BunnerResponse {
        http_status: crate::enums::HttpStatusCode::OK,
        headers: None,
        body: serde_json::Value::Null,
    };
    let request_id = Uuid::new_v4().to_string();
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);

    if !chain.execute(&mut request, &mut response, &payload) {
        let output = HandleRequestOutput {
            request_id,
            request,
            response,
        };

        tracing::event!(
            tracing::Level::TRACE,
            step = "middleware_stopped",
            request_key = request_key
        );

        callback_handle_request(cb, request_key, None, &output);

        return;
    }

    match ro.find(http_method, &request.path) {
        Ok((route_key, params_vec)) => {
            let params = if params_vec.is_empty() {
                None
            } else {
                let mut obj = serde_json::Map::new();

                for (k, (start, len)) in params_vec.iter() {
                    if *start + *len <= request.path.len() {
                        let raw = &request.path[*start..*start + *len];
                        let decoded = percent_decode_str(raw).decode_utf8_lossy().to_string();

                        obj.insert(k.clone(), JsonValue::String(decoded));
                    }
                }

                Some(JsonValue::Object(obj))
            };

            request.params = params;

            let output = HandleRequestOutput {
                request_id,
                request,
                response,
            };

            tracing::event!(
                tracing::Level::TRACE,
                step = "route_match",
                request_key = request_key,
                route_key = route_key,
                request_id = output.request_id,
            );

            callback_handle_request(cb, request_key, Some(route_key), &output);
        }
        Err(router_error) => {
            let mut be = HttpServerError::from(router_error);

            be.merge_extra(serde_json::json!({
                "operation": "handle_request_find",
                "requestKey": request_key,
                "method": http_method as u8,
                "path": request.path
            }));

            tracing::event!(
                tracing::Level::TRACE,
                step = "route_not_found",
                request_key = request_key
            );

            callback_handle_request(cb, request_key, None, &be);
        }
    }
}
