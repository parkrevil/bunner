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
        deserialize_with_simd_json::<T>(json_str)
    }
    #[cfg(not(feature = "simd-json"))]
    {
        deserialize_with_serde_json::<T>(json_str)
    }
}

#[cfg(not(feature = "simd-json"))]
pub fn deserialize_with_serde_json<T: DeserializeOwned>(
    json_str: &str,
) -> Result<T, InternalErrorCode> {
    serde_json::from_str::<T>(json_str).map_err(|err| {
        tracing::error!("serde_json deserialization error: {:?}", err);

        InternalErrorCode::InvalidJsonString
    })
}

#[cfg(feature = "simd-json")]
pub fn deserialize_with_simd_json<T: DeserializeOwned>(
    json_str: &str,
) -> Result<T, InternalErrorCode> {
    let mut bytes = json_str.as_bytes().to_vec();

    simd_json::from_slice::<T>(&mut bytes).map_err(|err| {
        tracing::error!("simd-json deserialization error: {:?}", err);

        InternalErrorCode::InvalidJsonString
    })
}
