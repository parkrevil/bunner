use crate::request_callback_dispatcher;
use crate::types::HandleRequestCallback;
use crate::utils::ffi::{make_result, make_string_pointer};
use serde::Serialize;

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    callback: HandleRequestCallback,
    request_id: Option<&str>,
    route_key: Option<u16>,
    result: &T,
) {
    let mut request_id_ptr: Option<*mut u8> = None;
    let res_ptr = make_result(result);

    if let Some(rid) = request_id {
        request_id_ptr = Some(make_string_pointer(rid));
    }

    unsafe {
        request_callback_dispatcher::enqueue(callback, request_id_ptr, route_key, res_ptr);
    }
}
