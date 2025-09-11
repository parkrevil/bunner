use serde::{Deserialize, Serialize};

use crate::router::errors::RouterErrorCode;

#[derive(Serialize, Deserialize, Debug)]
pub struct RouterError {
    pub code: RouterErrorCode,
    pub error: String,
    pub description: String,
    pub detail: Option<serde_json::Value>,
}

impl RouterError {
    /// Construct a RouterError. The caller must provide a context-specific description.
    pub fn new(
        code: RouterErrorCode,
        description: String,
        detail: Option<serde_json::Value>,
    ) -> Self {
        RouterError {
            error: code.as_str().to_string(),
            code,
            description,
            detail,
        }
    }
}

impl From<RouterErrorCode> for RouterError {
    fn from(code: RouterErrorCode) -> Self {
        // Fallback conversion when a contextual description is not provided at the call site.
        RouterError::new(
            code,
            format!("Router error: {}", code.as_str()),
            Some(serde_json::json!({"operation":"unknown","code": code as u16})),
        )
    }
}
