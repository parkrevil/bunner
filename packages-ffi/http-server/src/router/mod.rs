pub mod errors;
mod interner;
mod path;
mod pattern;
pub mod radix_tree;
pub mod readonly;
pub mod structures;

use crate::r#enum::HttpMethod;
pub use errors::RouterErrorCode;
use path::{is_path_character_allowed, normalize_path};
pub use readonly::RouterReadOnly;
pub use structures::RouterError;

#[derive(Debug, Default)]
pub struct RouteMatchResult {
    pub route_key: u16,
    pub parameter_offsets: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default)]
pub struct Router {
    radix_tree: radix_tree::RadixTree,
}

impl Router {
    pub fn new(options: Option<RouterOptions>) -> Self {
        Self {
            radix_tree: radix_tree::RadixTree::new(options.unwrap_or_default()),
        }
    }

    pub fn add(&mut self, method: HttpMethod, path: &str) -> Result<u16, RouterError> {
        self.radix_tree.insert(method, path)
    }

    pub fn add_bulk<I>(&mut self, entries: I) -> Result<Vec<u16>, RouterError>
    where
        I: IntoIterator<Item = (HttpMethod, String)>,
    {
        self.radix_tree.insert_bulk(entries)
    }

    pub fn find(
        &self,
        method: HttpMethod,
        path: &str,
    ) -> Result<(u16, Vec<(String, String)>), RouterError> {
        if path.is_empty() {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathEmpty,
                "Request path is empty".to_string(),
                Some(serde_json::json!({"operation":"find","path": path})),
            ));
        }

        if !path.is_ascii() {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathNotAscii,
                "Request path contains non-ASCII characters".to_string(),
                Some(serde_json::json!({"operation":"find","path": path})),
            ));
        }

        if !is_path_character_allowed(path) {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathContainsDisallowedCharacters,
                "Request path contains disallowed characters".to_string(),
                Some(serde_json::json!({"operation":"find","path": path})),
            ));
        }

        let normalized_path = normalize_path(path);

        if !is_path_character_allowed(&normalized_path) {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathContainsDisallowedCharacters,
                "Normalized request path contains disallowed characters".to_string(),
                Some(serde_json::json!({"operation":"find","path": normalized_path})),
            ));
        }

        if let Some(match_result) = self.radix_tree.find_normalized(method, &normalized_path) {
            let mut parameter_pairs = Vec::with_capacity(match_result.parameter_offsets.len());

            for (parameter_name, (start_offset, length)) in
                match_result.parameter_offsets.into_iter()
            {
                let parameter_value = &normalized_path[start_offset..start_offset + length];

                parameter_pairs.push((parameter_name, parameter_value.to_string()));
            }

            Ok((match_result.route_key, parameter_pairs))
        } else {
            Err(RouterError::new(
                RouterErrorCode::MatchNotFound,
                format!(
                    "No route matched path '{}' for method {:?}",
                    normalized_path, method
                ),
                Some(
                    serde_json::json!({"operation":"find","path": normalized_path, "method": method as u8}),
                ),
            ))
        }
    }

    pub fn finalize(&mut self) {
        self.radix_tree.finalize();
    }

    pub fn build_readonly(&self) -> RouterReadOnly {
        RouterReadOnly::from_router(self)
    }

    #[cfg(feature = "test")]
    pub fn get_internal_radix_router(&self) -> &radix_tree::RadixTree {
        &self.radix_tree
    }

    #[cfg(feature = "test")]
    pub fn reset_bulk_metrics(&self) {
        self.radix_tree.reset_bulk_metrics();
    }

    #[cfg(feature = "test")]
    pub fn bulk_metrics(&self) -> (usize, usize) {
        self.radix_tree.bulk_metrics()
    }
}

// snapshot removed in favor of RouterReadOnly

#[derive(Debug, Clone, Copy)]
pub struct RouterOptions {
    pub enable_root_level_pruning: bool,
    pub enable_static_route_full_mapping: bool,
    pub enable_automatic_optimization: bool,
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self {
            enable_root_level_pruning: false,
            enable_static_route_full_mapping: false,
            enable_automatic_optimization: true,
        }
    }
}
