use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{
    enums::{HttpMethod, HttpStatusCode},
    errors::HttpServerErrorCode,
};

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
    pub description: String,
    pub detail: Option<serde_json::Value>,
}

impl From<crate::router::RouterError> for HttpServerError {
    fn from(router_error: crate::router::RouterError) -> Self {
        HttpServerError {
            code: router_error.code.code(),
            error: router_error.error.clone(),
            description: router_error.description.clone(),
            detail: router_error.detail.clone(),
        }
    }
}

impl HttpServerError {
    pub fn new(
        code: HttpServerErrorCode,
        description: String,
        detail: Option<serde_json::Value>,
    ) -> Self {
        HttpServerError {
            error: code.as_str().to_string(),
            code: code.code(),
            description,
            detail,
        }
    }
}

impl HttpServerError {
    pub fn merge_detail(&mut self, new_detail: serde_json::Value) {
        if let Some(existing_detail) = self.detail.as_mut() {
            if let serde_json::Value::Object(existing_map) = existing_detail
                && let serde_json::Value::Object(new_map) = new_detail
            {
                existing_map.extend(new_map);
            }
        } else {
            self.detail = Some(new_detail);
        }
    }
}
