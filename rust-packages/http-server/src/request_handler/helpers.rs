use super::{callback_dispatcher, HandleRequestCallback};
use crate::utils::ffi::make_result;
use serde::Serialize;
use std::ffi::CString;

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    callback: HandleRequestCallback,
    request_id: Option<&str>,
    route_key: Option<u16>,
    result: &T,
) {
    let mut request_id_ptr: *mut std::os::raw::c_char = std::ptr::null_mut();

    if let Some(cstr) = request_id.and_then(|rid| CString::new(rid).ok()) {
        request_id_ptr = cstr.into_raw();
    }

    // Use shared FFI helper to produce a len-prefixed result pointer and enqueue
    let res_ptr = make_result(result);

    callback_dispatcher::enqueue(
        callback,
        Some(request_id_ptr),
        route_key,
        res_ptr as *mut std::os::raw::c_char,
    );
}
