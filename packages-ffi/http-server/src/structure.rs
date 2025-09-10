use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
pub struct HandleRequestResponse {
    #[serde(rename = "httpStatus")]
    pub http_status: u16,
    pub headers: Option<HashMap<String, String>>,
    pub body: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HandleRequestResult {
    #[serde(rename = "routeKey")]
    pub route_key: u16,
    pub params: Option<serde_json::Value>,
    #[serde(rename = "queryParams")]
    pub query_params: Option<serde_json::Value>,
    pub body: Option<serde_json::Value>,
    pub ip: String,
    #[serde(rename = "ipVersion")]
    pub ip_version: u8,
    #[serde(rename = "httpProtocol")]
    pub http_protocol: String,
    #[serde(rename = "httpVersion")]
    pub http_version: String,
    pub headers: serde_json::Value,
    pub cookies: serde_json::Value,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub charset: String,
    pub response: Option<HandleRequestResponse>,
}
