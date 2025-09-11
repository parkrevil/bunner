use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::r#enum::{HttpMethod, HttpStatusCode};

#[derive(Serialize, Deserialize, Debug)]
pub struct AddRouteResult {
    pub key: u16,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FfiError {
    pub code: u16,
    pub message: Option<String>,
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
    #[serde(default, skip_serializing, skip_deserializing)]
    pub headers: serde_json::Value,
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
pub struct BunnerErrorData {
    pub code: u16,
    pub error: String,
    pub description: String,
    pub detail: Option<serde_json::Value>,
}

impl From<crate::router::RouterError> for BunnerErrorData {
    fn from(router_error: crate::router::RouterError) -> Self {
        BunnerErrorData {
            code: router_error.code as u16,
            error: router_error.error.clone(),
            description: router_error.description.clone(),
            detail: router_error.detail.clone(),
        }
    }
}
