use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;

// tracing initialization (idempotent)
#[allow(dead_code)]
pub fn init_tracing_once() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    static LEVEL_OVERRIDE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    ONCE.call_once(|| {
        #[allow(unused_imports)]
        use tracing_subscriber::{EnvFilter, fmt};
        // Precedence: enum override > BUNNER_HTTP_SERVER_LOG_LEVEL > RUST_LOG > "info"
        let filter = if let Some(level) = LEVEL_OVERRIDE.get() {
            EnvFilter::try_new(level.clone()).unwrap_or_else(|_| EnvFilter::new("info"))
        } else if let Ok(level) = std::env::var("BUNNER_HTTP_SERVER_LOG_LEVEL") {
            EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"))
        } else {
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
        };
        let _ = fmt().with_env_filter(filter).compact().try_init();
    });
}

#[allow(dead_code)]
pub fn set_log_level_override(level: &str) -> bool {
    static LEVEL_OVERRIDE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    LEVEL_OVERRIDE.set(level.to_string()).is_ok()
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

// ============ Limits ============
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub qs_max_depth: usize,
    pub qs_max_keys: usize,
    pub cookie_max_bytes: usize,
    pub cookie_max_count: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            qs_max_depth: 5,
            qs_max_keys: 256,
            cookie_max_bytes: 4096,
            cookie_max_count: 64,
        }
    }
}

static LIMITS: std::sync::OnceLock<Limits> = std::sync::OnceLock::new();

pub fn get_limits() -> Limits {
    *LIMITS.get_or_init(Limits::default)
}

pub fn set_limits(l: Limits) -> bool {
    LIMITS.set(l).is_ok()
}
