use crate::constants::PACKAGE_VERSION;
use crate::router::RouterError;

use super::FfiErrorCode;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct FfiError {
    pub code: u16,
    pub error: String,
    pub subsystem: String,
    pub stage: String,
    pub cause: String,
    pub ts: u64,
    pub thread: String,
    pub version: String,
    pub description: String,
    pub extra: Option<serde_json::Value>,
}

impl From<Box<RouterError>> for FfiError {
    fn from(router_error: Box<RouterError>) -> Self {
        FfiError {
            code: router_error.code.code(),
            error: router_error.error.clone(),
            subsystem: router_error.subsystem.clone(),
            stage: router_error.stage.clone(),
            cause: router_error.cause.clone(),
            ts: router_error.ts,
            thread: router_error.thread.clone(),
            version: PACKAGE_VERSION.to_string(),
            description: router_error.description.clone(),
            extra: router_error.extra.clone(),
        }
    }
}

impl FfiError {
    fn generate_metadata() -> (u64, String) {
        let ts = {
            use std::time::{SystemTime, UNIX_EPOCH};
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();
            now.as_millis() as u64
        };
        let thread = format!("{:?}", std::thread::current().id());
        (ts, thread)
    }

    pub fn new(
        code: FfiErrorCode,
        subsystem: &str,
        stage: &str,
        cause: &str,
        description: String,
        extra: Option<serde_json::Value>,
    ) -> Self {
        let (ts, thread) = Self::generate_metadata();

        FfiError {
            code: code.code(),
            error: code.as_str().to_string(),
            subsystem: subsystem.to_string(),
            stage: stage.to_string(),
            cause: cause.to_string(),
            description,
            extra,
            ts,
            thread,
            version: PACKAGE_VERSION.to_string(),
        }
    }

    pub fn merge_extra(&mut self, new_extra: serde_json::Value) {
        if let Some(existing) = self.extra.as_mut() {
            if let serde_json::Value::Object(existing_map) = existing
                && let serde_json::Value::Object(new_map) = new_extra
            {
                existing_map.extend(new_map);
            }
        } else {
            self.extra = Some(new_extra);
        }
    }
}
