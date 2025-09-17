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

    pub fn finalize(&mut self) {
        self.radix_tree.finalize();
    }

    pub fn build_readonly(&self) -> RouterReadOnly {
        RouterReadOnly::from_router(self)
    }

    /// Return a clone of the read-only snapshot if set.
    pub fn get_readonly(&self) -> Option<std::sync::Arc<RouterReadOnly>> {
        self.read_only.get().map(std::sync::Arc::clone)
    }

    /// Whether the router has been sealed (read-only snapshot present).
    pub fn is_sealed(&self) -> bool {
        self.read_only.get().is_some()
    }

    /// Finalize the builder router, build a read-only snapshot and return it.
    /// This encapsulates the common sealing steps used by the HTTP server.
    pub fn seal(&mut self) -> RouterReadOnly {
        self.finalize();
        self.build_readonly()
    }

    /// Finalize this builder router, build a read-only snapshot and set it into
    /// the provided `OnceLock`. Returns the RouterReadOnly for convenience.
    pub fn seal_into(&mut self) -> RouterReadOnly {
        let ro = self.seal();
        let _ = self.read_only.set(std::sync::Arc::new(ro.clone()));
        ro
    }

    /// Finalize this builder router, build a read-only snapshot, set it into
    /// this router's `read_only` OnceLock, and replace the builder router with
    /// an empty sealed router in-place.
    pub fn seal_and_reset(&mut self) -> RouterReadOnly {
        let ro = self.seal_into();
        let _old = std::mem::replace(self, Router::new(None));
        ro
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
