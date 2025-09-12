use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    ptr,
    sync::Arc,
};
use crate::errors::HttpServerErrorCode;
use crate::structure::{AddRouteResult, HttpServerError};
use crate::util::{make_ffi_bunner_error_result, serialize_to_cstring};
use crate::r#enum::HttpMethod;
use crate::util::make_ffi_result;
use serde::Serialize;

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    cb: extern "C" fn(*const c_char, u16, *mut c_char),
    request_id: Option<&str>,
    route_key: u16,
    result: &T,
) {
    let request_id_ptr = match request_id {
        Some(s) => {
            let cstr = CString::new(s).unwrap();
            let ptr = cstr.as_ptr();

            std::mem::forget(cstr);

            ptr
        },
        None => ptr::null(),
    };

    cb(request_id_ptr, route_key, serialize_to_cstring(result));
}
