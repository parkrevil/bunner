use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;

use crate::structure::{FfiError, FfiResult};

pub fn serialize_to_cstring<T: Serialize>(value: &T) -> *mut c_char {
  match serde_json::to_string(value) {
      Ok(json_string) => CString::new(json_string).unwrap().into_raw(),
      Err(_) => {
          let error_json = "{\"data\":null,\"error\":{\"code\":-1,\"message\":\"Serialization failed\"}}";

          CString::new(error_json).unwrap().into_raw()
      }
  }
}

pub fn make_ffi_result<T: Serialize>(data: T, error: Option<FfiError>) -> *mut c_char {
    serialize_to_cstring(&FfiResult {
        data: Some(data),
        error,
    })
}

pub fn make_ffi_error_result(error: FfiError) -> *mut c_char {
    serialize_to_cstring(&FfiResult::<()> {
        data: None,
        error: Some(error),
    })
}
