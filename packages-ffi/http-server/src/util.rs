use serde::Serialize;
use serde_json::json;
use std::ffi::CString;
use std::os::raw::c_char;
use std::thread;

// tracing initialization (idempotent)
#[allow(dead_code)]
pub fn init_tracing_once() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        #[allow(unused_imports)]
        use tracing_subscriber::{fmt, EnvFilter};
        // Precedence: BUNNER_HTTP_SERVER_LOG_LEVEL > RUST_LOG > "info"
        let filter = if let Ok(level) = std::env::var("BUNNER_HTTP_SERVER_LOG_LEVEL") {
            EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"))
        } else {
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
        };
        let _ = fmt().with_env_filter(filter).compact().try_init();
    });
}

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
    let ts = {
        #[allow(unused_imports)]
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        // milliseconds since epoch for portability without chrono dependency
        now.as_millis()
    };
    let thread_id = format!("{:?}", thread::current().id());
    let mut base = json!({
        "operation": operation,
        "ts": ts,
        "thread": thread_id,
        "version": env!("CARGO_PKG_VERSION")
    });
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
