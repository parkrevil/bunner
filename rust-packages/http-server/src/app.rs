use crate::enums::{HttpMethod, HttpStatusCode, LenPrefixedString};
use crate::errors::{FfiError, FfiErrorCode};
use crate::middlewares::{
    BodyParser, CookieParser, HeaderParser, Lifecycle, MiddlewareChain, UrlParser,
};
use crate::request_callback_dispatcher;
use crate::router::structures::RouterResult;
use crate::router::{Router, RouterReadOnly};
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestOutput, HandleRequestPayload};
use crate::thread_pool::submit_job;
use crate::types::{RequestKey, WorkerId};
use crate::utils::{ffi::make_result, json::deserialize};

use super::HandleRequestCallback;

use percent_encoding::percent_decode_str;
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::{str, sync::Arc};
use uuid::Uuid;

#[repr(C)]
pub struct App {
    router: Router,
    middleware_chain: Arc<MiddlewareChain>,
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}

impl App {
    pub fn new() -> Self {
        let mut middleware_chain = MiddlewareChain::new();

        middleware_chain.add_to(Lifecycle::PreRequest, HeaderParser);
        middleware_chain.add_to(Lifecycle::PreRequest, UrlParser);
        middleware_chain.add_to(Lifecycle::PreRequest, CookieParser);
        middleware_chain.add_to(Lifecycle::PreRequest, BodyParser);

        App {
            router: Router::new(None),
            middleware_chain: Arc::new(middleware_chain),
        }
    }

    pub fn add_route(
        &self,
        worker_id: WorkerId,
        method: HttpMethod,
        path: &str,
    ) -> RouterResult<u16> {
        self.router.add(worker_id, method, path)
    }

    pub fn add_routes(
        &self,
        worker_id: WorkerId,
        routes: Vec<(HttpMethod, String)>,
    ) -> RouterResult<Vec<u16>> {
        self.router.add_bulk(worker_id, routes)
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
                callback_handle_request(cb, request_key, None, &FfiError::from(e));

                return;
            }
        };

        let middleware_chain = self.middleware_chain.clone();

        match submit_job(Box::new(move || {
            process_request(cb, request_key, payload, ro, middleware_chain);
        })) {
            Ok(()) => {
                tracing::trace!("request enqueued");
            }
            Err(_e) => {
                tracing::warn!(
                    reason = "queue_full",
                    "Failed to enqueue request; queue may be full"
                );

                let err = FfiError::new(
                    FfiErrorCode::QueueFull,
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
    middleware_chain: Arc<MiddlewareChain>,
) {
    tracing::trace!("processing request");

    let payload_str_ref = match &payload_str {
        LenPrefixedString::Text(s) => s.as_str(),
        // SAFETY: The FFI caller (TypeScript side) guarantees that the payload is valid UTF-8.
        // Therefore we intentionally use `str::from_utf8_unchecked` here to avoid an extra check.
        // This function is `unsafe` and the caller must uphold the UTF-8 guarantee.
        LenPrefixedString::Bytes(b) => unsafe { std::str::from_utf8_unchecked(b) },
    };
    let payload = match deserialize::<HandleRequestPayload>(payload_str_ref) {
        Ok(p) => p,
        Err(_) => {
            let err = FfiError::new(
                FfiErrorCode::InvalidArgument,
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
            let bunner_error = FfiError::new(
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
        request_id: Uuid::new_v4().to_string(),
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
        http_status: HttpStatusCode::OK,
        headers: None,
        body: serde_json::Value::Null,
    };

    if !middleware_chain.execute(Lifecycle::PreRequest, &mut request, &mut response, &payload) {
        tracing::event!(
            tracing::Level::TRACE,
            step = "middleware_stopped",
            request_key = request_key
        );

        callback_handle_request(
            cb,
            request_key,
            None,
            &HandleRequestOutput { request, response },
        );

        return;
    }

    if !middleware_chain.execute(Lifecycle::OnRequest, &mut request, &mut response, &payload) {
        tracing::event!(
            tracing::Level::TRACE,
            step = "middleware_stopped",
            request_key = request_key
        );

        callback_handle_request(
            cb,
            request_key,
            None,
            &HandleRequestOutput { request, response },
        );

        return;
    }

    let (route_key, params) = match ro.find(http_method, &request.path) {
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

                tracing::event!(
                    tracing::Level::TRACE,
                    step = "route_match",
                    request_key = request_key,
                    route_key = route_key
                );

                Some(JsonValue::Object(obj))
            };

            (route_key, params)
        }
        Err(router_error) => {
            let mut be = FfiError::from(router_error);

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

            return;
        }
    };

    request.params = params;

    if !middleware_chain.execute(
        Lifecycle::BeforeHandle,
        &mut request,
        &mut response,
        &payload,
    ) {
        tracing::event!(
            tracing::Level::TRACE,
            step = "middleware_before_handle_stopped",
            request_key = request_key
        );

        callback_handle_request(
            cb,
            request_key,
            None,
            &HandleRequestOutput { request, response },
        );

        return;
    }

    callback_handle_request(
        cb,
        request_key,
        Some(route_key),
        &HandleRequestOutput { request, response },
    );
}

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    callback: HandleRequestCallback,
    request_key: RequestKey,
    route_key: Option<u16>,
    result: &T,
) {
    let res_ptr = make_result(result);

    unsafe {
        request_callback_dispatcher::enqueue(callback, request_key, route_key, res_ptr);
    }
}
