use serde::Serialize;
use serde_json::json;
use std::ffi::CString;
use std::os::raw::c_char;

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

/// Build a standard error detail payload with mandatory operation and optional extra fields.
/// This is crate-wide and should be preferred over module-local helpers.
pub fn make_error_detail(operation: &str, extra: serde_json::Value) -> serde_json::Value {
    let mut base = json!({"operation": operation});
    if let serde_json::Value::Object(ref mut map) = base {
        match extra {
            serde_json::Value::Object(extra_map) => {
                for (k, v) in extra_map.into_iter() {
                    map.insert(k, v);
                }
            }
            serde_json::Value::Null => {}
            other => {
                map.insert("extra".to_string(), other);
            }
        }
    }
    base
}
