use bumpalo::Bump;
use hashbrown::HashMap as FastHashMap;
use parking_lot::Mutex;
use smallvec::SmallVec;

use super::{RouterOptions};
use crate::router::interner::Interner;

pub(super) const METHOD_COUNT: usize = 7;
pub(super) const METHOD_BIT: [u8; METHOD_COUNT] =
    [1 << 0, 1 << 1, 1 << 2, 1 << 3, 1 << 4, 1 << 5, 1 << 6];

mod alloc;
mod compress;
mod find;
mod insert;
pub(super) mod node;

use alloc::{new_node_box_from_arena_ptr, NodeBox};
pub use node::RadixNode;

#[derive(Debug, Default)]
pub struct RadixRouter {
    pub(super) root: RadixNode,
    pub(super) options: RouterOptions,
    // lightweight metrics
    pub(super) cand_total: std::sync::atomic::AtomicU64,
    pub(super) cand_samples: std::sync::atomic::AtomicU64,
    // arena for node allocations (prepared for full conversion)
    pub(super) arena: Bump,
    pub(super) interner: Interner,
    // recent candidate sizes for p50/p99 approximation
    pub(super) cand_recent: Mutex<SmallVec<[u16; 512]>>,
    // root-level method→first-byte bitmap for early prune (sealed only)
    pub(super) method_head_bits: [[u64; 4]; METHOD_COUNT],
    pub(super) root_param_first_present: [bool; METHOD_COUNT],
    pub(super) root_wildcard_present: [bool; METHOD_COUNT],
    // fast path: full static routes map by method (normalized path key)
    pub(super) static_full_map: [FastHashMap<String, u16>; METHOD_COUNT],
    // root-level first segment length buckets (0..=63; bit63 means >=63)
    pub(super) method_len_buckets: [u64; METHOD_COUNT],
    // feature toggles (from RouterOptions)
    pub(super) enable_root_prune: bool,
    pub(super) enable_static_full_map: bool,
    // auto key allocator
    pub(super) next_key: std::sync::atomic::AtomicU16,
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
                // recompute method mask lazily from children and own routes (will correct in post pass)
                node.method_mask = 0;
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
        // post-order pass to compute method masks accurately
        fn compute_mask(n: &mut RadixNode) -> u8 {
            let mut m: u8 = 0;
            for i in 0..METHOD_COUNT {
                if n.routes[i] != 0 || n.wildcard_routes[i] != 0 {
                    m |= 1 << i;
                }
            }
            for child in n.static_vals.iter_mut() {
                m |= compute_mask(child.as_mut());
            }
            for (_, v) in n.static_children.iter_mut() {
                m |= compute_mask(v.as_mut());
            }
            for nb in n.pattern_nodes.iter_mut() {
                m |= compute_mask(nb.as_mut());
            }
            if let Some(fc) = n.fused_child.as_mut() {
                m |= compute_mask(fc.as_mut());
            }
            n.method_mask = m;
            m
        }
        compute_mask(&mut self.root);
        // debug seal dump removed
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
        let s = Self {
            root: RadixNode::default(),
            options,
            cand_total: std::sync::atomic::AtomicU64::new(0),
            cand_samples: std::sync::atomic::AtomicU64::new(0),
            arena: Bump::with_capacity(64 * 1024),
            interner: Interner::new(),
            cand_recent: Mutex::new(SmallVec::new()),
            method_head_bits: [[0; 4]; METHOD_COUNT],
            root_param_first_present: [false; METHOD_COUNT],
            root_wildcard_present: [false; METHOD_COUNT],
            static_full_map: Default::default(),
            method_len_buckets: [0; METHOD_COUNT],
            enable_root_prune: options.enable_root_prune,
            enable_static_full_map: options.enable_static_full_map,
            next_key: std::sync::atomic::AtomicU16::new(1),
        };
        crate::router::log_avx2_once();
        s
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
        // build root-level bitmaps and flags
        self.method_head_bits = [[0; 4]; METHOD_COUNT];
        self.root_param_first_present = [false; METHOD_COUNT];
        self.root_wildcard_present = [false; METHOD_COUNT];
        self.method_len_buckets = [0; METHOD_COUNT];
        {
            let n = &self.root;
            for m in 0..METHOD_COUNT {
                if n.wildcard_routes[m] != 0 {
                    self.root_wildcard_present[m] = true;
                }
            }
            // Include fused edge at root as a static head candidate
            if let Some(edge) = n.fused_edge.as_ref() {
                if let Some(&b0) = edge.as_str().as_bytes().first() {
                    let mut b = b0;
                    if !self.options.case_sensitive && b.is_ascii_uppercase() {
                        b |= 0x20;
                    }
                    let blk = (b as usize) >> 6;
                    let bit = 1u64 << ((b as usize) & 63);
                    let mask = n.method_mask;
                    for mi in 0..METHOD_COUNT {
                        if (mask & (1 << mi)) != 0 {
                            self.method_head_bits[mi][blk] |= bit;
                        }
                    }
                }
                let l = edge.len().min(63) as u32;
                let mask = n.method_mask;
                for mi in 0..METHOD_COUNT {
                    if (mask & (1 << mi)) != 0 {
                        self.method_len_buckets[mi] |= 1u64 << l;
                    }
                }
            }
            for k in n.static_keys.iter() {
                if let Some(&b) = k.as_bytes().first() {
                    let blk = (b as usize) >> 6;
                    let bit = 1u64 << ((b as usize) & 63);
                    let mask = n.method_mask;
                    for m in 0..METHOD_COUNT {
                        if (mask & (1 << m)) != 0 {
                            self.method_head_bits[m][blk] |= bit;
                        }
                    }
                }
                let l = k.len().min(63) as u32;
                let mask = n.method_mask;
                for m in 0..METHOD_COUNT {
                    if (mask & (1 << m)) != 0 {
                        self.method_len_buckets[m] |= 1u64 << l;
                    }
                }
            }
            // Also include map-based static children
            for (k, _) in n.static_children.iter() {
                if let Some(&b) = k.as_bytes().first() {
                    let blk = (b as usize) >> 6;
                    let bit = 1u64 << ((b as usize) & 63);
                    let mask = n.method_mask;
                    for m in 0..METHOD_COUNT {
                        if (mask & (1 << m)) != 0 {
                            self.method_head_bits[m][blk] |= bit;
                        }
                    }
                }
                let l = k.len().min(63) as u32;
                let mask = n.method_mask;
                for m in 0..METHOD_COUNT {
                    if (mask & (1 << m)) != 0 {
                        self.method_len_buckets[m] |= 1u64 << l;
                    }
                }
            }
            for (&hb, _) in n.pattern_first_lit_head.iter() {
                let blk = (hb as usize) >> 6;
                let bit = 1u64 << ((hb as usize) & 63);
                let mask = n.method_mask;
                for m in 0..METHOD_COUNT {
                    if (mask & (1 << m)) != 0 {
                        self.method_head_bits[m][blk] |= bit;
                    }
                }
            }
            // include literal-first pattern lengths at root
            for pat in n.patterns.iter() {
                if let Some(crate::router::pattern::SegmentPart::Literal(l0)) = pat.parts.first() {
                    let l = l0.len().min(63) as u32;
                    let mask = n.method_mask;
                    for m in 0..METHOD_COUNT {
                        if (mask & (1 << m)) != 0 {
                            self.method_len_buckets[m] |= 1u64 << l;
                        }
                    }
                } else {
                    // param-first: mark as present for all lengths by disabling prune via flag above
                }
            }
            if !n.pattern_param_first.is_empty() {
                let mask = n.method_mask;
                for m in 0..METHOD_COUNT {
                    if (mask & (1 << m)) != 0 {
                        self.root_param_first_present[m] = true;
                    }
                }
            }
        }
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
        // Optional cache warm-up to reduce first-hit latency
        fn warm_node(n: &node::RadixNode) {
            // touch children to pull into cache
            for v in n.static_vals.iter() {
                let _ = v.as_ref().routes[0];
            }
            for (_, v) in n.static_children.iter() {
                let _ = v.as_ref().routes[0];
            }
            for nb in n.pattern_nodes.iter() {
                let _ = nb.as_ref().routes[0];
            }
            if let Some(fc) = n.fused_child.as_ref() {
                let _ = fc.as_ref().routes[0];
            }
            for v in n.static_vals.iter() {
                warm_node(v.as_ref());
            }
            for (_, v) in n.static_children.iter() {
                warm_node(v.as_ref());
            }
            for nb in n.pattern_nodes.iter() {
                warm_node(nb.as_ref());
            }
            if let Some(fc) = n.fused_child.as_ref() {
                warm_node(fc.as_ref());
            }
        }
        warm_node(&self.root);
        // Build static full maps for O(1) lookup when path is entirely static
        for m in 0..METHOD_COUNT {
            self.static_full_map[m].clear();
        }
        fn collect_static(
            n: &node::RadixNode,
            buf: &mut String,
            maps: &mut [FastHashMap<String, u16>; METHOD_COUNT],
            case_sensitive: bool,
        ) {
            let base_len = buf.len();
            if let Some(edge) = n.fused_edge.as_ref() {
                if buf.is_empty() {
                    buf.push('/');
                }
                buf.push_str(edge.as_str());
            }
            for (i, &rk) in n.routes.iter().enumerate() {
                if rk != 0 {
                    let mut key = if buf.is_empty() {
                        "/".to_string()
                    } else {
                        buf.clone()
                    };
                    if !case_sensitive {
                        key = key.to_ascii_lowercase();
                    }
                    maps[i].insert(key, rk);
                }
            }
            // traverse array-based static keys/vals in order
            if !n.static_keys.is_empty() && n.static_vals_idx.len() == n.static_keys.len() {
                for (k_idx, nb) in n.static_keys.iter().zip(n.static_vals_idx.iter()) {
                    let prev = buf.len();
                    buf.push('/');
                    buf.push_str(k_idx.as_str());
                    collect_static(nb.as_ref(), buf, maps, case_sensitive);
                    buf.truncate(prev);
                }
            }
            for (k, v) in n.static_children.iter() {
                let prev = buf.len();
                buf.push('/');
                buf.push_str(k.as_str());
                collect_static(v.as_ref(), buf, maps, case_sensitive);
                buf.truncate(prev);
            }
            if let Some(fc) = n.fused_child.as_ref() {
                collect_static(fc.as_ref(), buf, maps, case_sensitive);
            }
            buf.truncate(base_len);
        }
        if self.enable_static_full_map {
            let mut path_buf = String::from("");
            collect_static(
                &self.root,
                &mut path_buf,
                &mut self.static_full_map,
                self.options.case_sensitive,
            );
        }
    }
}
