use crate::errors::internal_error::InternalErrorCode;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::ffi::{c_char, CString};

#[cfg(feature = "simd-json")]
use simd_json;

pub fn serialize<T: Serialize>(value: &T) -> Result<String, InternalErrorCode> {
    #[cfg(feature = "simd-json")]
    {
        serialize_with_simd_json(value)
    }
    #[cfg(not(feature = "simd-json"))]
    {
        serialize_with_serde_json(value)
    }
}

#[cfg(not(feature = "simd-json"))]
pub fn serialize_with_serde_json<T: Serialize>(value: &T) -> Result<String, InternalErrorCode> {
    serde_json::to_string(value).map_err(|err| {
        tracing::error!("serde_json serialization error: {:?}", err);

        InternalErrorCode::InvalidJsonValue
    })
}

#[cfg(feature = "simd-json")]
pub fn serialize_with_simd_json<T: Serialize>(value: &T) -> Result<String, InternalErrorCode> {
    simd_json::to_string(value).map_err(|err| {
        tracing::error!("simd-json serialization error: {:?}", err);

        InternalErrorCode::InvalidJsonValue
    })
}

pub fn deserialize<T: DeserializeOwned>(json_str: &str) -> Result<T, InternalErrorCode> {
    #[cfg(feature = "simd-json")]
    {
        deserialize_with_simd_json(json_str)
    }
    #[cfg(not(feature = "simd-json"))]
    {
        deserialize_with_serde_json(json_str)
    }
}

#[cfg(not(feature = "simd-json"))]
pub fn deserialize_with_serde_json<T: DeserializeOwned>(
    json_str: &str,
) -> Result<T, InternalErrorCode> {
    serde_json::from_str(json_str).map_err(|err| {
        tracing::error!("serde_json deserialization error: {:?}", err);

        InternalErrorCode::InvalidJsonString
    })
}

#[cfg(feature = "simd-json")]
pub fn deserialize_with_simd_json<T: DeserializeOwned>(
    json_str: &str,
) -> Result<T, InternalErrorCode> {
    let mut bytes = json_str.as_bytes().to_vec();

    simd_json::from_slice(&mut bytes).map_err(|err| {
        tracing::error!("simd-json deserialization error: {:?}", err);

        InternalErrorCode::InvalidJsonString
    })
}

pub fn to_c_string(value: &str) -> *mut c_char {
    match CString::new(value) {
        Ok(cstr) => crate::pointer_registry::register_cstring_and_into_raw(cstr),
        Err(e) => {
            tracing::trace!(
                "Failed to create CString, value contains null bytes: {:?}",
                e
            );
            std::ptr::null_mut()
        }
    }
}

pub fn serialize_and_to_c_string<T: Serialize>(value: &T) -> *mut c_char {
    match serialize(value) {
        Ok(json_string) => to_c_string(&json_string),
        Err(e) => {
            tracing::trace!("Failed to serialize value for CString conversion: {:?}", e);

            std::ptr::null_mut()
        }
    }
}
