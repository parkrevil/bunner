use serde::Serialize;
use crate::utils::{json};
use super::{callback_dispatcher, HandleRequestCallback};

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    callback: HandleRequestCallback,
    request_id: Option<&str>,
    route_key: Option<u16>,
    result: &T,
) {
    let result_cstr = json::serialize_and_to_c_string(result);

    tracing::event!(
        tracing::Level::TRACE,
        path = "callback_handle_request",
        subpath = "enqueue",
        req_id = ?request_id,
        route_key = route_key,
    );

    callback_dispatcher::enqueue(callback, request_id, route_key, result_cstr);
}
