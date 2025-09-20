use crate::{
    enums::{HttpMethod, HttpStatusCode, LogLevel},
    types::AppId,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Debug)]
pub struct AppOptions {
    #[serde(rename = "logLevel")]
    pub log_level: LogLevel,
}

impl AppOptions {
    pub fn log_level(&self) -> LogLevel {
        self.log_level
    }
}

#[derive(Serialize, Debug)]
pub struct InitResult {
    #[serde(rename = "appId")]
    pub app_id: AppId,
}

#[derive(Serialize, Debug)]
pub struct AddRouteResult {
    pub key: u16,
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
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "httpMethod")]
    pub http_method: HttpMethod,
    #[serde(skip_serializing, skip_deserializing)]
    pub url: String,
    pub path: String,
    #[serde(default)]
    #[serde(skip_serializing)]
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

#[derive(Deserialize, Debug)]
pub struct HandleRequestPayload {
    #[serde(rename = "httpMethod")]
    pub http_method: u8,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HandleRequestOutput {
    pub request: BunnerRequest,
    pub response: BunnerResponse,
}
