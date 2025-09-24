use crate::{
    enums::{HttpMethod, HttpStatusCode, LogLevel},
    types::AppId,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Debug, Clone)]
pub struct AppOptions {
    #[serde(rename = "appName")]
    pub name: String,
    #[serde(rename = "logLevel")]
    pub log_level: LogLevel,
    pub workers: u16,
    #[serde(rename = "queueCapacity")]
    pub queue_capacity: u32,
    #[serde(default, rename = "trustProxy")]
    pub trust_proxy: bool,
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

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequestMetadata {
    pub ip: Option<String>,
    pub ips: Option<Vec<String>>,
    #[serde(default)]
    pub is_trusted_proxy: bool,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BunnerRequest {
    pub request_id: String,
    pub http_method: HttpMethod,
    #[serde(skip_serializing, skip_deserializing)]
    pub url: String,
    pub path: String,
    pub query_string: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing)]
    pub headers: HashMap<String, String>,
    // Derived by header/url parser middleware
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<u16>,
    pub ip: Option<String>,
    pub ips: Option<Vec<String>>,
    pub is_trusted_proxy: bool,
    pub subdomains: Option<Vec<String>>,
    pub cookies: serde_json::Value,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub charset: Option<String>,
    pub params: Option<serde_json::Value>,
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
    #[serde(default)]
    pub request: RequestMetadata,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HandleRequestOutput {
    pub request: BunnerRequest,
    pub response: BunnerResponse,
}
