use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::r#enum::HttpMethod;

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
    pub http_status: u16,
    pub headers: Option<HashMap<String, String>>,
    pub body: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BunnerRequest {
    #[serde(skip_serializing, skip_deserializing)]
    pub url: String,
    #[serde(rename = "httpMethod")]
    pub http_method: HttpMethod,
    pub path: String,
    pub headers: serde_json::Value,
    pub cookies: serde_json::Value,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub charset: String,
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
