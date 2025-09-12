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
