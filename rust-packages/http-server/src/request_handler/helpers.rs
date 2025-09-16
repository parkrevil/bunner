use super::{callback_dispatcher, HandleRequestCallback};
use crate::utils::json;
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
    let result_cstr = json::serialize_and_to_c_string(result);

    if let Some(cstr) = request_id.and_then(|rid| CString::new(rid).ok()) {
        request_id_ptr = cstr.into_raw();
    }

    callback_dispatcher::enqueue(callback, Some(request_id_ptr), route_key, result_cstr);
}
