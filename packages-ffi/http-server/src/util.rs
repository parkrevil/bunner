use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;

pub fn serialize_to_cstring<T: Serialize>(value: &T) -> *mut c_char {
    // Best-effort serialize; on failure, return a minimal error JSON.
    let json_string = serde_json::to_string(value)
        .unwrap_or_else(|_| "{\"code\":-1,\"message\":\"Serialization failed\"}".to_string());

    // Ensure no interior NULs to avoid CString::new panics. JSON should not contain NULs,
    // but sanitize defensively for FFI safety.
    let sanitized = if json_string.as_bytes().contains(&0) {
        json_string.replace('\0', "\\u0000")
    } else {
        json_string
    };

    match CString::new(sanitized) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            // Fallback hard-coded JSON without NULs
            let fallback = "{\"code\":-1,\"message\":\"Serialization failed\"}";
            // Safety: no interior NULs in fallback string literal
            CString::new(fallback).expect("static string has no NULs").into_raw()
        }
    }
}

pub fn from_ptr<T>(ptr: *mut c_char) -> Result<T, Box<dyn std::error::Error>>
where
    T: serde::de::DeserializeOwned,
{
    if ptr.is_null() {
        return Err("Null pointer".into());
    }

    let c_str = unsafe { std::ffi::CStr::from_ptr(ptr) };
    let json_str = c_str.to_str().map_err(|e: std::str::Utf8Error| Box::new(e) as Box<dyn std::error::Error>)?;
    let value: T = serde_json::from_str(&json_str).map_err(|e: serde_json::Error| Box::new(e) as Box<dyn std::error::Error>)?;
    Ok(value)
}
