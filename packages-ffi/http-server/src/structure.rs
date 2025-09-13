use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{
    enums::{HttpMethod, HttpStatusCode},
    errors::HttpServerErrorCode,
};

// Cache version string to avoid repeated env! calls
static VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize, Deserialize, Debug)]
pub struct AddRouteResult {
    pub key: u16,
}

// Payload/result for async handle_request
#[derive(Deserialize, Debug)]
pub struct HandleRequestPayload {
    #[serde(rename = "httpMethod")]
    pub http_method: u8,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BunnerResponse {
    #[serde(rename = "httpStatus")]
    pub http_status: HttpStatusCode,
    pub headers: Option<HashMap<String, String>>,
    pub body: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BunnerRequest {
    #[serde(rename = "httpMethod")]
    pub http_method: HttpMethod,
    #[serde(skip_serializing, skip_deserializing)]
    pub url: String,
    pub path: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub cookies: serde_json::Value,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(rename = "contentLength")]
    pub content_length: Option<u64>,
    pub charset: Option<String>,
    pub params: Option<serde_json::Value>,
    #[serde(rename = "queryParams")]
    pub query_params: Option<serde_json::Value>,
    pub body: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HandleRequestOutput {
    pub request: BunnerRequest,
    pub response: BunnerResponse,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HttpServerError {
    pub code: u16,
    pub error: String,
    pub subsystem: String,
    pub stage: String,
    pub cause: String,
    pub ts: u64,
    pub thread: String,
    pub version: String,
    pub description: String,
    #[serde(rename = "extra")]
    pub extra: Option<serde_json::Value>,
}

impl From<crate::router::RouterError> for HttpServerError {
    fn from(router_error: crate::router::RouterError) -> Self {
        HttpServerError {
            code: router_error.code.code(),
            error: router_error.error.clone(),
            subsystem: router_error.subsystem.clone(),
            stage: router_error.stage.clone(),
            cause: router_error.cause.clone(),
            ts: router_error.ts,
            thread: router_error.thread.clone(),
            version: VERSION.to_string(),
            description: router_error.description.clone(),
            extra: router_error.extra.clone(),
        }
    }
}

impl HttpServerError {
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
        code: HttpServerErrorCode,
        subsystem: &str,
        stage: &str,
        cause: &str,
        description: String,
        extra: Option<serde_json::Value>,
    ) -> Self {
        let (ts, thread) = Self::generate_metadata();
        
        HttpServerError {
            code: code.code(),
            error: code.as_str().to_string(),
            subsystem: subsystem.to_string(),
            stage: stage.to_string(),
            cause: cause.to_string(),
            description,
            extra,
            ts,
            thread,
            version: VERSION.to_string(),
        }
    }
}

impl HttpServerError {
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
