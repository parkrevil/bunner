pub mod errors;
mod interner;
mod path;
mod pattern;
pub mod radix_tree;
pub mod readonly;
pub mod structures;

use crate::enums::HttpMethod;
pub use errors::RouterErrorCode;
// path utils are consumed by readonly module only
pub use readonly::RouterReadOnly;
pub use structures::RouterError;
use structures::RouterResult;

#[derive(Debug, Default)]
pub struct RouteMatchResult {
    pub route_key: u16,
    pub parameter_offsets: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default)]
pub struct Router {
    radix_tree: radix_tree::RadixTree,
    read_only: std::sync::OnceLock<std::sync::Arc<RouterReadOnly>>,
}

impl Router {
    pub fn new(options: Option<RouterOptions>) -> Self {
        Self {
            radix_tree: radix_tree::RadixTree::new(options.unwrap_or_default()),
            read_only: std::sync::OnceLock::new(),
        }
    }

    pub fn add(&mut self, method: HttpMethod, path: &str) -> RouterResult<u16> {
        self.radix_tree.insert(method, path)
    }

    pub fn add_bulk<I>(&mut self, entries: I) -> RouterResult<Vec<u16>>
    where
        I: IntoIterator<Item = (HttpMethod, String)>,
    {
        self.radix_tree.insert_bulk(entries)
    }

    pub fn is_sealed(&self) -> bool {
        self.read_only.get().is_some()
    }

    pub fn seal(&mut self) {
        // Finalize radix tree and build read-only snapshot.
        self.radix_tree.finalize();
        let ro = RouterReadOnly::from_router(self);

        // Create Arc for the snapshot before replacing `self`.
        let arc = std::sync::Arc::new(ro.clone());

        // Replace builder router with a fresh one in-place, then store the
        // snapshot into the new router's OnceLock so it persists for readers.
        let _old = std::mem::replace(self, Router::new(None));
        let _ = self.read_only.set(arc);
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
