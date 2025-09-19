use crate::request_callback_dispatcher;
use crate::types::{HandleRequestCallback, RequestKey};
use crate::utils::ffi::make_result;
use serde::Serialize;

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
