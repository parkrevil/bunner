//! Router module providing radix-based matching with configurable policies.
//!
//! Example: using `RouterBuilder` and `RouterHandle`.
//!
//! ```rust
//! use crate::router::{RouterBuilder, Method};
//!
//! let handle = RouterBuilder::with_options(Default::default())
//!     .add(Method::GET, "/users/:id(\\d+)", 42)
//!     .add(Method::GET, "/assets/*", 7)
//!     .seal()
//!     .build();
//!
//! if let Some(m) = handle.find(Method::GET, "/users/123") {
//!     assert_eq!(m.key, 42);
//! }
//! ```
//!
//! Options summary (defaults in parentheses):
//! - `ignore_trailing_slash` (false): `/a` matches `/a/` when true
//! - `ignore_duplicate_slashes` (false): collapses `//` to `/`
//! - `case_sensitive` (true): if false, literals are matched ASCII-ci
//! - `max_param_length` (100): maximum bytes per parameter, including wildcard
//! - `allow_unsafe_regex` (false): when false, rejects potentially unsafe regex
//! - `strict_param_names` (true): when true, param names must match between patterns at the same position
// std HashMap not needed; all internals live in radix

mod pattern;
mod regex_guard;
mod radix;
mod errors;
mod compress;

/// HTTP method supported by the router.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Method { GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD }

/// Route registration item (method, path, unique key).
#[derive(Debug, Clone)]
pub struct Route {
    pub method: Method,
    pub path: String,
    pub key: u64,
}

/// Result of a successful match (route key and parameter offsets).
#[derive(Debug, Default)]
pub struct MatchResult {
    pub key: u64,
    // zero-copy friendly: (name, (start, len)) over the original path
    pub params: Vec<(String, (usize, usize))>,
}

/// High-level Router facade. Use `with_options` to configure, `add` to register, and `find` to match.
#[derive(Debug, Default)]
pub struct Router {
    radix: radix::RadixRouter,
}

impl Router {
    /// Create a Router with default options.
    pub fn new() -> Self { Self::with_options(RouterOptions::default(), None) }

    /// Create a Router with custom options.
    pub fn with_options(options: RouterOptions, _default_key: Option<u64>) -> Self {
        Self { radix: radix::RadixRouter::new(options) }
    }

    /// Register a route. Returns silently; prefer `register_route_ex` for detailed errors.
    pub fn add(&mut self, method: Method, path: &str, key: u64) { let _ = self.radix.insert(method, path, key); }

    /// Match an incoming request method/path.
    pub fn find(&self, method: Method, path: &str) -> Option<MatchResult> {
        self.radix.find(method, path)
    }
}

fn method_from_u32(m: u32) -> Method {
    match m {
        0 => Method::GET,
        1 => Method::POST,
        2 => Method::PUT,
        3 => Method::PATCH,
        4 => Method::DELETE,
        5 => Method::OPTIONS,
        6 => Method::HEAD,
        _ => Method::GET,
    }
}

/// Register a route. Returns true on success and also on idempotent conflicts, false otherwise.
pub fn register_route(router: &mut Router, method: u32, path: &str, key: u64) -> bool {
    let method = method_from_u32(method);
    match router.radix.insert(method, path, key) {
        Ok(()) => true,
        Err(errors::InsertError::Conflict) => true, // idempotent/no-op on conflict
        Err(_) => false,
    }
}

/// Register a route; returns 0 on success or a non-zero InsertError code.
pub fn register_route_ex(router: &mut Router, method: u32, path: &str, key: u64) -> u32 {
    let method = method_from_u32(method);
    match router.radix.insert(method, path, key) {
        Ok(()) => 0,
        Err(e) => e as u32,
    }
}

/// Match a route and materialize parameter strings at the API boundary.
pub fn match_route(router: &Router, method: u32, path: &str) -> Option<(u64, Vec<(String, String)>)> {
    let method = method_from_u32(method);
    // Use the same normalized string for matching and slicing to keep offsets consistent.
    let norm = normalize_path(path, &router.radix.options);
    router.find(method, &norm).map(|m| {
        let mut out = Vec::with_capacity(m.params.len());
        for (name, (start, len)) in m.params.into_iter() {
            let val = &norm[start..start+len];
            out.push((name, val.to_string()));
        }
        (m.key, out)
    })
}

/// Seal the router; after sealing, the data structure is compressed and immutable.
pub fn seal(router: &mut Router) { router.radix.seal(); }

/// Router options controlling normalization and matching behavior.
#[derive(Debug, Clone, Copy)]
pub struct RouterOptions {
    pub ignore_trailing_slash: bool,
    pub ignore_duplicate_slashes: bool,
    pub case_sensitive: bool,
    pub max_param_length: usize,
    pub max_total_params: usize,
    pub max_path_length: usize,
    pub regex_cache_capacity: usize,
    pub allow_unsafe_regex: bool,
    pub strict_param_names: bool,
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self {
            ignore_trailing_slash: false,
            ignore_duplicate_slashes: false,
            case_sensitive: true,
            max_param_length: 100,
            max_total_params: 16,
            max_path_length: 4096,
            regex_cache_capacity: 256,
            allow_unsafe_regex: false,
            strict_param_names: true,
        }
    }
}

/// Re-export insertion error for external callers.
pub use errors::InsertError;

fn normalize_path(path: &str, opts: &RouterOptions) -> String {
    let bytes = path.as_bytes();
    let mut out = String::with_capacity(bytes.len());
    let mut i = 0;
    let mut prev_slash = false;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'/' {
            if !opts.ignore_duplicate_slashes || !prev_slash { out.push('/'); }
            prev_slash = true;
            i += 1;
            continue;
        }
        prev_slash = false;
        out.push(b as char);
        i += 1;
    }
    if opts.ignore_trailing_slash && out.len() > 1 && out.as_bytes()[out.len()-1] == b'/' {
        let mut end = out.len();
        while end > 1 && out.as_bytes()[end-1] == b'/' { end -= 1; }
        out.truncate(end);
    }
    out
}

// fallback helpers removed (radix handles all)

// Builder/Handle split (non-breaking addition)

/// Builder for an immutable RouterHandle. Chain `add`, then `seal`, then `build`.
#[derive(Debug, Default)]
pub struct RouterBuilder {
    radix: radix::RadixRouter,
}

impl RouterBuilder {
    /// Create a new builder with default options.
    pub fn new() -> Self { Self { radix: radix::RadixRouter::new(RouterOptions::default()) } }
    /// Create a new builder with custom options.
    pub fn with_options(options: RouterOptions) -> Self { Self { radix: radix::RadixRouter::new(options) } }
    /// Add a route to the builder.
    pub fn add(mut self, method: Method, path: &str, key: u64) -> Self { let _ = self.radix.insert(method, path, key); self }
    /// Seal (compress and freeze) the router.
    pub fn seal(mut self) -> Self { self.radix.seal(); self }
    /// Build an immutable handle for concurrent lookups.
    pub fn build(self) -> RouterHandle { RouterHandle { radix: self.radix } }
}

/// Immutable router handle intended for concurrent reads.
#[derive(Debug)]
pub struct RouterHandle {
    radix: radix::RadixRouter,
}

impl RouterHandle {
    /// Match an incoming request method/path.
    pub fn find(&self, method: Method, path: &str) -> Option<MatchResult> { self.radix.find(method, path) }
}

