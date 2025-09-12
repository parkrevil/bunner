use serde::{Deserialize, Serialize};

use crate::router::errors::RouterErrorCode;
// json helper moved to crate::util::make_error_detail; no direct json import needed here

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

    /// Merge additional context into detail. Initializes detail as object if absent.
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
