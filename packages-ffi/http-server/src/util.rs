use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;

use crate::structure::HttpServerError;

pub fn serialize_to_cstring<T: Serialize>(value: &T) -> *mut c_char {
    match serde_json::to_string(value) {
        Ok(json_string) => CString::new(json_string).unwrap().into_raw(),
        Err(_) => {
            // Unify error envelope to { code, message }
            let error_json = "{\"code\":-1,\"message\":\"Serialization failed\"}";
            CString::new(error_json).unwrap().into_raw()
        }
    }
}

pub fn make_ffi_result<T: Serialize>(data: T) -> *mut c_char {
    serialize_to_cstring(&data)
}

pub fn make_ffi_bunner_error_result(error: &HttpServerError) -> *mut c_char {
    serialize_to_cstring(error)
}
