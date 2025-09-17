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
use parking_lot::RwLock;

#[derive(Debug, Default)]
pub struct RouteMatchResult {
    pub route_key: u16,
    pub parameter_offsets: Vec<(String, (usize, usize))>,
}

#[derive(Debug)]
struct RouterInner {
    pub radix_tree: radix_tree::RadixTree,
    pub ro: std::sync::OnceLock<std::sync::Arc<RouterReadOnly>>,
}

#[derive(Debug)]
pub struct Router {
    inner: RwLock<RouterInner>,
}

impl Router {
    pub fn new(options: Option<RouterOptions>) -> Self {
        Self {
            inner: RwLock::new(RouterInner {
                radix_tree: radix_tree::RadixTree::new(options.unwrap_or_default()),
                ro: std::sync::OnceLock::new(),
            }),
        }
    }

    pub fn add(&self, method: HttpMethod, path: &str) -> RouterResult<u16> {
        let mut g = self.inner.write();
        g.radix_tree.insert(method, path)
    }

    pub fn add_bulk<I>(&self, entries: I) -> RouterResult<Vec<u16>>
    where
        I: IntoIterator<Item = (HttpMethod, String)>,
    {
        let mut g = self.inner.write();
        g.radix_tree.insert_bulk(entries)
    }

    pub fn is_sealed(&self) -> bool {
        let g = self.inner.read();
        g.ro.get().is_some()
    }

    pub fn seal(&self) {
        let mut g = self.inner.write();

        // finalize and build readonly snapshot from the radix tree
        g.radix_tree.finalize();
        let ro = RouterReadOnly::from_radix_tree(&g.radix_tree);
        let arc = std::sync::Arc::new(ro.clone());

        // replace radix_tree with a fresh one and set readonly snapshot on the inner
        g.radix_tree = radix_tree::RadixTree::new(Default::default());
        let _ = g.ro.set(arc);
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
