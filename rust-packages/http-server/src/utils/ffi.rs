use super::json::{deserialize, serialize};
use super::string::{len_prefixed_pointer_to_string, string_to_len_prefixed_buffer};
use crate::errors::internal_error::InternalErrorCode;
use serde::{de::DeserializeOwned, Serialize};

/// Parse a len-prefixed pointer into a JSON string, then deserialize into `serde_json::Value`.
pub fn parse_json_pointer<T: DeserializeOwned>(ptr: *const u8) -> Result<T, InternalErrorCode> {
    if ptr.is_null() {
        return Err(InternalErrorCode::PointerIsNull);
    }

    let s = unsafe { len_prefixed_pointer_to_string(ptr)? };

    match deserialize::<T>(&s) {
        Ok(v) => Ok(v),
        Err(e) => Err(e),
    }
}

/// Serialize `value` to JSON string and return a len-prefixed raw pointer allocated/registered by Rust.
pub fn make_result<T: Serialize>(value: &T) -> *mut u8 {
    match serialize::<T>(value) {
        Ok(s) => string_to_len_prefixed_buffer(&s),
        Err(_) => std::ptr::null_mut(),
    }
}
