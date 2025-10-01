use crate::{
    enums::{HttpMethod, HttpStatusCode, LogLevel},
    types::{AppId, RouteKey},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn empty_json_object() -> serde_json::Value {
    serde_json::Value::Object(serde_json::Map::new())
}

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
    pub status: Option<HttpStatusCode>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<serde_json::Value>,
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
    pub url: String,
    pub path: String,
    pub query_string: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    // Derived by header/url parser middleware
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<u16>,
    pub ip: Option<String>,
    #[serde(default)]
    pub ips: Vec<String>,
    pub is_trusted_proxy: bool,
    #[serde(default)]
    pub subdomains: Vec<String>,
    pub cookies: serde_json::Value,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub charset: Option<String>,
    #[serde(default = "empty_json_object")]
    pub params: serde_json::Value,
    #[serde(default = "empty_json_object")]
    pub query_params: serde_json::Value,
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
pub struct HandleRequestResult {
    #[serde(rename = "routeKey")]
    pub route_key: Option<RouteKey>,
    pub request: BunnerRequest,
    pub response: BunnerResponse,
}
