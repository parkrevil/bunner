use crate::enums::HttpMethod;
use crate::errors::{HttpServerError, HttpServerErrorCode};
use crate::helpers::callback_handle_request;
use crate::middleware::{BodyParser, Chain, CookieParser, HeaderParser, UrlParser};
use crate::router::{Router, RouterReadOnly};
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestOutput, HandleRequestPayload};
use crate::thread_pool::submit_job;
use crate::utils::ffi::parse_json_pointer;

use super::HandleRequestCallback;

use percent_encoding::percent_decode_str;
use serde_json::Value as JsonValue;
use std::{ffi::CStr, os::raw::c_char, sync::mpsc, sync::Arc, time::Duration};

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
        request_id_ptr: *const c_char,
        payload_ptr: *const u8,
    ) {
        let (ack_tx, ack_rx) = mpsc::channel::<()>();
        let ro = match self.router.get_readonly() {
            Ok(r) => r,
            Err(e) => {
                callback_handle_request(cb, None, None, &HttpServerError::from(e));

                return;
            }
        };

        let request_id_addr = request_id_ptr as usize;
        let payload_addr = payload_ptr as usize;

        match submit_job(Box::new(move || {
            let request_id_ptr = request_id_addr as *const c_char;
            let payload_ptr = payload_addr as *const u8;

            _process_request(cb, request_id_ptr, payload_ptr, ro, ack_tx);
        })) {
            Ok(()) => {
                tracing::trace!("request enqueued");
            }
            Err(_e) => {
                tracing::warn!(
                    reason = "queue_full",
                    "Failed to enqueue request; queue may be full"
                );

                let http_error = HttpServerError::new(
                    HttpServerErrorCode::QueueFull,
                    "thread_pool",
                    "enqueue",
                    "backpressure",
                    "Request queue is full".to_string(),
                    None,
                );

                callback_handle_request(cb, None, None, &http_error);
            }
        }

        let parsing_timeout = Duration::from_millis(1000);

        match ack_rx.recv_timeout(parsing_timeout) {
            Ok(()) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::RequestAckTimeout,
                    "ffi",
                    "handle_request",
                    "timeout",
                    "Worker did not ack request parsing within timeout".to_string(),
                    None,
                );

                callback_handle_request(cb, None, None, &http_error);
            }
            Err(_) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::RequestAckTimeout,
                    "ffi",
                    "handle_request",
                    "channel",
                    "Failed to receive ack from worker".to_string(),
                    None,
                );

                callback_handle_request(cb, None, None, &http_error);
            }
        }
    }
}

fn _process_request(
    cb: HandleRequestCallback,
    request_id_ptr: *const c_char,
    payload_ptr: *const u8,
    ro: Arc<RouterReadOnly>,
    parsing_ack: mpsc::Sender<()>,
) {
    let request_id = match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
        Ok(s) => s.to_string(),
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidRequestId,
                "app",
                "process_request",
                "parsing",
                "Request id is not valid UTF-8".to_string(),
                Some(serde_json::json!({"requestIdPtr": format!("{:p}", request_id_ptr)})),
            );

            callback_handle_request(cb, None, None, &http_error);

            return;
        }
    };
    let payload = match unsafe { parse_json_pointer::<HandleRequestPayload>(payload_ptr) } {
        Ok(p) => p,
        Err(_) => {
            // We cannot easily construct a preview without reading the pointer here; keep error concise.
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "app",
                "process_request",
                "parsing",
                "Failed to parse request payload JSON".to_string(),
                Some(serde_json::json!({"requestId": request_id})),
            );

            tracing::event!(tracing::Level::ERROR, reason="parse_payload_error", request_id=%request_id);

            callback_handle_request(cb, Some(request_id.as_str()), None, &err);

            return;
        }
    };

    let _ = parsing_ack.send(());

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
                    serde_json::json!({"requestId": request_id, "httpMethod": payload.http_method}),
                ),
            );

            callback_handle_request(cb, Some(request_id.as_str()), None, &bunner_error);

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
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);

    if !chain.execute(&mut request, &mut response, &payload) {
        let output = HandleRequestOutput { request, response };

        tracing::event!(tracing::Level::TRACE, step = "middleware_stopped", request_id=%request_id);

        callback_handle_request(cb, Some(request_id.as_str()), None, &output);

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

            let output = HandleRequestOutput { request, response };

            tracing::event!(
                tracing::Level::TRACE,
                step = "route_match",
                route_key = route_key as u64,
                request_id=%request_id
            );

            callback_handle_request(cb, Some(request_id.as_str()), Some(route_key), &output);
        }
        Err(router_error) => {
            let mut be = HttpServerError::from(router_error);

            be.merge_extra(serde_json::json!({
                "operation": "handle_request_find",
                "requestId": request_id,
                "method": http_method as u8,
                "path": request.path
            }));

            tracing::event!(tracing::Level::TRACE, step = "route_not_found", request_id=%request_id);

            callback_handle_request(cb, Some(request_id.as_str()), None, &be);
        }
    }
}
