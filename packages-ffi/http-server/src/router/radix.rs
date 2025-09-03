use bumpalo::Bump;
use dashmap::DashMap;
use regex::Regex;
use std::sync::{Arc, atomic::AtomicU64};

use super::RouterMetrics;
use super::{Method, RouterOptions};
use crate::router::interner::Interner;

pub(super) const METHOD_COUNT: usize = 7;

#[inline(always)]
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

mod alloc;
mod compress;
mod find;
mod insert;
pub(super) mod node;

use alloc::{NodeBox, new_node_box_from_arena_ptr};
pub use node::RadixNode;

#[derive(Debug, Default)]
pub struct RadixRouter {
    pub(super) root: RadixNode,
    pub(super) options: RouterOptions,
    pub(super) regex_cache: Arc<DashMap<String, (Regex, u64)>>,
    pub(super) regex_clock: AtomicU64,
    // arena for node allocations (prepared for full conversion)
    pub(super) arena: Bump,
    pub(super) interner: Interner,
}

impl RadixRouter {
    pub fn compress(&mut self) {
        self.invalidate_indices();
        compress::compress_root(&mut self.root);
    }
    pub(super) fn build_indices(&mut self) {
        let mut stack: Vec<*mut RadixNode> = Vec::with_capacity(1024);
        stack.push(&mut self.root as *mut _);
        while let Some(ptr) = stack.pop() {
            let node = unsafe { &mut *ptr };
            if node.dirty {
                node.static_vals_idx.clear();
                node.static_children_idx.clear();
                node.pattern_children_idx.clear();
                node.fused_child_idx = None;
                if !node.static_keys.is_empty() {
                    let mut tmp_idxs: smallvec::SmallVec<[NodeBox; 16]> = smallvec::SmallVec::new();
                    tmp_idxs.reserve(node.static_vals.len());
                    for child in node.static_vals.iter() {
                        tmp_idxs.push(NodeBox(child.0));
                    }
                    node.static_vals_idx.extend(tmp_idxs);
                }
                if !node.static_children.is_empty() {
                    let keys: smallvec::SmallVec<[String; 16]> =
                        node.static_children.keys().cloned().collect();
                    for k in keys {
                        if let Some(v) = node.static_children.get(&k) {
                            node.static_children_idx.insert(k, NodeBox(v.0));
                        }
                    }
                }
                if !node.patterns.is_empty() {
                    node.pattern_children_idx.clear();
                    node.pattern_children_idx.reserve(node.patterns.len());
                    for i in 0..node.patterns.len() {
                        node.pattern_children_idx.push(i);
                    }
                }
                if let Some(fc) = node.fused_child.as_ref() {
                    node.fused_child_idx = Some(NodeBox(fc.0));
                }
                node.rebuild_intern_ids(&self.interner);
                node.dirty = false;
            }
            for child in node.static_vals.iter_mut() {
                stack.push(child.as_mut() as *mut _);
            }
            for (_, v) in node.static_children.iter_mut() {
                stack.push(v.as_mut() as *mut _);
            }
            for nb in node.pattern_nodes.iter_mut() {
                stack.push(nb.as_mut() as *mut _);
            }
            if let Some(fc) = node.fused_child.as_mut() {
                stack.push(fc.as_mut() as *mut _);
            }
        }
    }
    #[inline]
    pub(super) fn invalidate_indices(&mut self) {
        let mut stack: Vec<*mut RadixNode> = Vec::with_capacity(1024);
        stack.push(&mut self.root as *mut _);
        while let Some(ptr) = stack.pop() {
            let node = unsafe { &mut *ptr };
            node.static_vals_idx.clear();
            node.static_children_idx.clear();
            node.pattern_children_idx.clear();
            node.fused_child_idx = None;
            for child in node.static_vals.iter_mut() {
                stack.push(child.as_mut() as *mut _);
            }
            for (_, v) in node.static_children.iter_mut() {
                stack.push(v.as_mut() as *mut _);
            }
            for nb in node.pattern_nodes.iter_mut() {
                stack.push(nb.as_mut() as *mut _);
            }
            if let Some(fc) = node.fused_child.as_mut() {
                stack.push(fc.as_mut() as *mut _);
            }
        }
    }
    pub fn new(options: RouterOptions) -> Self {
        Self {
            root: RadixNode::default(),
            options,
            regex_cache: Arc::new(DashMap::new()),
            regex_clock: AtomicU64::new(1),
            arena: Bump::with_capacity(64 * 1024),
            interner: Interner::new(),
        }
    }
    pub fn seal(&mut self) {
        self.root.sealed = true;
        self.compress();
        {
            let mut stack: Vec<*mut RadixNode> = Vec::with_capacity(1024);
            stack.push(&mut self.root as *mut _);
            while let Some(ptr) = stack.pop() {
                let node = unsafe { &mut *ptr };
                node.dirty = true;
                for child in node.static_vals.iter_mut() {
                    stack.push(child.as_mut() as *mut _);
                }
                for (_, v) in node.static_children.iter_mut() {
                    stack.push(v.as_mut() as *mut _);
                }
                for nb in node.pattern_nodes.iter_mut() {
                    stack.push(nb.as_mut() as *mut _);
                }
                if let Some(fc) = node.fused_child.as_mut() {
                    stack.push(fc.as_mut() as *mut _);
                }
            }
        }
        fn sort_node(n: &mut RadixNode, interner: &Interner) {
            if !n.static_keys.is_empty() && n.static_keys.len() == n.static_vals.len() {
                let mut pairs: Vec<(u32, String, NodeBox)> = n
                    .static_keys
                    .iter()
                    .cloned()
                    .zip(n.static_vals.iter().map(|nb| NodeBox(nb.0)))
                    .map(|(k, v)| (interner.intern(k.as_str()), k, v))
                    .collect();
                pairs.sort_unstable_by(|a, b| a.0.cmp(&b.0));
                n.static_keys.clear();
                n.static_vals.clear();
                for (_id, k, v) in pairs.into_iter() {
                    n.static_keys.push(k);
                    n.static_vals.push(v);
                }
            }
            for (_, v) in n.static_children.iter_mut() {
                sort_node(v.as_mut(), interner);
            }
            for nb in n.pattern_nodes.iter_mut() {
                sort_node(nb.as_mut(), interner);
            }
            if let Some(fc) = n.fused_child.as_mut() {
                sort_node(fc.as_mut(), interner);
            }
        }
        sort_node(&mut self.root, &self.interner);
        self.build_indices();
        fn shrink_node(n: &mut RadixNode) {
            n.static_keys.shrink_to_fit();
            n.static_vals.shrink_to_fit();
            n.static_vals_idx.shrink_to_fit();
            n.pattern_children_idx.shrink_to_fit();
            n.patterns.shrink_to_fit();
            n.pattern_nodes.shrink_to_fit();
            n.pattern_first_literal.shrink_to_fit();
            n.pattern_scores.shrink_to_fit();
            for (_, v) in n.static_children.iter_mut() {
                shrink_node(v.as_mut());
            }
            for nb in n.pattern_nodes.iter_mut() {
                shrink_node(nb.as_mut());
            }
            if let Some(fc) = n.fused_child.as_mut() {
                shrink_node(fc.as_mut());
            }
        }
        shrink_node(&mut self.root);
    }

    pub(super) fn collect_metrics(&self) -> RouterMetrics {
        let mut out = RouterMetrics::default();
        let mut stack: Vec<&node::RadixNode> = Vec::with_capacity(1024);
        stack.push(&self.root);
        while let Some(n) = stack.pop() {
            out.pattern_first_literal_hits += n.pfl_hits.load(std::sync::atomic::Ordering::Relaxed);
            out.shape_hits += n.shape_hits.load(std::sync::atomic::Ordering::Relaxed);
            out.shape_misses += n.shape_misses.load(std::sync::atomic::Ordering::Relaxed);
            for v in n.static_vals.iter() {
                stack.push(v.as_ref());
            }
            for (_, v) in n.static_children.iter() {
                stack.push(v.as_ref());
            }
            for v in n.pattern_nodes.iter() {
                stack.push(v.as_ref());
            }
            if let Some(fc) = n.fused_child.as_ref() {
                stack.push(fc.as_ref());
            }
        }
        out
    }
}
