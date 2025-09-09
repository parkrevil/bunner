use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct Request<'a> {
    #[serde(rename = "httpMethod")]
    pub http_method: &'a str,
    pub url: &'a str,
    pub headers: HashMap<String, String>,
    pub body: Option<&'a str>,
}

#[derive(Serialize)]
pub struct AddRouteResult {
    pub key: u16,
}

#[derive(Serialize)]
pub struct HandleRequestResult {
    pub key: u16,
    pub params: Option<HashMap<String, String>>,
    pub error: u16,
    pub error_message: Option<String>,
}

#[derive(Serialize)]
pub struct FfiError {
    pub code: u16,
    pub message: Option<String>,
}
