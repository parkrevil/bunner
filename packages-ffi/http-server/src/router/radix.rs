//! Radix router core module.
//!
//! This module declares the `RadixRouter` type and wires submodules:
//! - `node`: radix node structure and indexes
//! - `insert`: route insertion and segment parsing
//! - `find`: matching logic

use dashmap::DashMap;
use regex::Regex;
use std::sync::{Arc, atomic::AtomicU64};

use super::{Method, RouterOptions};

pub(super) const METHOD_COUNT: usize = 7;

#[inline]
pub(super) fn method_index(m: Method) -> usize {
    match m {
        Method::GET => 0,
        Method::POST => 1,
        Method::PUT => 2,
        Method::PATCH => 3,
        Method::DELETE => 4,
        Method::OPTIONS => 5,
        Method::HEAD => 6,
    }
}

pub(super) mod node;
mod insert;
mod find;
mod compress;

pub use node::RadixNode;

/// Router facade over the radix tree. Build (insert/seal) first, then find() concurrently.
#[derive(Debug, Default)]
pub struct RadixRouter {
    pub(super) root: RadixNode,
    pub(super) options: RouterOptions,
    pub(super) regex_cache: Arc<DashMap<String, (Regex, u64)>>,
    pub(super) regex_clock: AtomicU64,
}

impl RadixRouter {
    pub fn compress(&mut self) { compress::compress_root(&mut self.root); }
    pub fn new(options: RouterOptions) -> Self {
        Self {
            root: RadixNode::default(),
            options,
            regex_cache: Arc::new(DashMap::new()),
            regex_clock: AtomicU64::new(1),
        }
    }
    pub fn seal(&mut self) { self.root.sealed = true; self.compress(); }
}
