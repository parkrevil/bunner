use crate::types::StaticString;
use serde::de::DeserializeOwned;
use serde::Serialize;

#[cfg(feature = "simd-json")]
use simd_json;

pub fn serialize<T: Serialize>(value: &T) -> Result<String, StaticString> {
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
pub fn serialize_with_serde_json<T: Serialize>(value: &T) -> Result<String, StaticString> {
    serde_json::to_string(value).map_err(|err| {
        tracing::error!("serde_json serialization error: {:?}", err);

        "serde_json serialization error"
    })
}

#[cfg(feature = "simd-json")]
pub fn serialize_with_simd_json<T: Serialize>(value: &T) -> Result<String, StaticString> {
    simd_json::to_string(value).map_err(|err| {
        tracing::error!("simd-json serialization error: {:?}", err);

        "simd-json serialization error"
    })
}

pub fn deserialize<T: DeserializeOwned>(json_str: &str) -> Result<T, StaticString> {
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
pub fn deserialize_with_serde_json<T: DeserializeOwned>(json_str: &str) -> Result<T, StaticString> {
    serde_json::from_str::<T>(json_str).map_err(|err| {
        tracing::error!("serde_json deserialization error: {:?}", err);

        "serde_json deserialization error"
    })
}

#[cfg(feature = "simd-json")]
pub fn deserialize_with_simd_json<T: DeserializeOwned>(json_str: &str) -> Result<T, StaticString> {
    let mut bytes = json_str.as_bytes().to_vec();

    simd_json::from_slice::<T>(&mut bytes).map_err(|err| {
        tracing::error!("simd-json deserialization error: {:?}", err);

        "simd-json deserialization error"
    })
}
