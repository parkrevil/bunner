use super::NodeBox;
use core::sync::atomic::{AtomicU64, Ordering};
use hashbrown::HashMap as FastHashMap;
use smallvec::SmallVec;

use crate::router::interner::Interner;
use crate::router::pattern::{
    SegmentPart, SegmentPattern, pattern_score, pattern_shape_key, pattern_shape_weak_key,
};

use super::METHOD_COUNT;

pub(super) type StaticMap = FastHashMap<String, NodeBox>;
pub(super) type StaticMapIdx = FastHashMap<String, super::NodeBox>;

#[derive(Debug, Default)]
pub struct RadixNode {
    // optimize small number of siblings before promoting to map
    pub(super) static_keys: SmallVec<[String; 16]>,
    pub(super) static_vals: SmallVec<[NodeBox; 16]>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(super) static_vals_idx: SmallVec<[super::NodeBox; 16]>,
    // interned ids aligned with static_keys
    pub(super) static_key_ids: SmallVec<[u32; 16]>,
    pub(super) static_children: StaticMap,
    pub(super) static_children_idx: StaticMapIdx,
    // id-keyed mirror for static children
    pub(super) static_children_idx_ids: FastHashMap<u32, super::NodeBox>,
    // SoA: separate pattern specs and node handles
    pub(super) patterns: SmallVec<[SegmentPattern; 4]>,
    pub(super) pattern_nodes: SmallVec<[NodeBox; 4]>,
    // ordered view indices for fast iteration
    pub(super) pattern_children_idx: SmallVec<[usize; 8]>,
    // first literal -> indices in pattern_children (to reduce regex calls)
    pub(super) pattern_first_literal: FastHashMap<String, SmallVec<[usize; 16]>>,
    // cached specificity scores aligned with pattern_children
    pub(super) pattern_scores: SmallVec<[usize; 16]>,
    // group indices by shape key to reduce linear scans on insert
    pub(super) pattern_shape_index: FastHashMap<u64, SmallVec<[usize; 16]>>,
    pub(super) pattern_shape_weak_index: FastHashMap<u64, SmallVec<[usize; 16]>>,
    // lightweight metrics (Relaxed) for tuning
    pub(super) pfl_hits: AtomicU64,
    #[allow(dead_code)]
    pub(super) shape_hits: AtomicU64,
    #[allow(dead_code)]
    pub(super) shape_misses: AtomicU64,
    pub(super) routes: [u64; METHOD_COUNT],
    pub(super) wildcard_routes: [u64; METHOD_COUNT],
    pub(super) sealed: bool,
    pub(super) dirty: bool,
    // prefix compression (set by compress())
    pub(super) fused_edge: Option<String>,
    pub(super) fused_child: Option<NodeBox>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(super) fused_child_idx: Option<super::NodeBox>,
}

impl RadixNode {
    #[inline(always)]
    pub(super) fn get_static_ref(&self, key: &str) -> Option<&RadixNode> {
        if let Some(n) = self.static_children.get(key) {
            return Some(n.as_ref());
        }
        if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
            return Some(self.static_vals[pos].as_ref());
        }
        None
    }

    #[inline(always)]
    pub(super) fn get_static_fast(&self, key: &str) -> Option<&RadixNode> {
        if let Some(nb) = self.static_children_idx.get(key) {
            return Some(nb.as_ref());
        }
        if !self.static_keys.is_empty() && self.static_vals_idx.len() == self.static_keys.len() {
            // small-N linear scan is often faster than binary search
            if self.static_keys.len() <= 8 {
                if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
                    return Some(self.static_vals_idx[pos].as_ref());
                }
            } else {
                // binary search on sorted static_keys
                let mut lo = 0usize;
                let mut hi = self.static_keys.len();
                while lo < hi {
                    let mid = (lo + hi) >> 1;
                    let cmp = self.static_keys[mid].as_str().cmp(key);
                    if cmp.is_lt() {
                        lo = mid + 1;
                    } else if cmp.is_gt() {
                        hi = mid;
                    } else {
                        return Some(self.static_vals_idx[mid].as_ref());
                    }
                }
            }
        }
        None
    }

    #[inline(always)]
    #[allow(dead_code)]
    pub(super) fn get_static_id_fast(&self, key_id: u32) -> Option<&RadixNode> {
        if let Some(nb) = self.static_children_idx_ids.get(&key_id) {
            return Some(nb.as_ref());
        }
        if !self.static_key_ids.is_empty()
            && self.static_vals_idx.len() == self.static_key_ids.len()
        {
            // binary search on sorted intern ids
            let mut lo = 0usize;
            let mut hi = self.static_key_ids.len();
            while lo < hi {
                let mid = (lo + hi) >> 1;
                let id = self.static_key_ids[mid];
                if id < key_id {
                    lo = mid + 1;
                } else if id > key_id {
                    hi = mid;
                } else {
                    return Some(self.static_vals_idx[mid].as_ref());
                }
            }
        }
        None
    }

    pub(super) fn rebuild_intern_ids(&mut self, interner: &Interner) {
        self.static_key_ids.clear();
        if !self.static_keys.is_empty() {
            self.static_key_ids.reserve(self.static_keys.len());
            for k in self.static_keys.iter() {
                self.static_key_ids.push(interner.intern(k.as_str()));
            }
        }
        self.static_children_idx_ids.clear();
        if !self.static_children.is_empty() {
            for (k, v) in self.static_children.iter() {
                let id = interner.intern(k.as_str());
                self.static_children_idx_ids.insert(id, super::NodeBox(v.0));
            }
        }
    }

    /// Same as `descend_static_mut` but uses provided allocator for child creation.
    pub(super) fn descend_static_mut_with_alloc<F>(
        &mut self,
        key: String,
        alloc: F,
    ) -> &mut RadixNode
    where
        F: FnOnce() -> NodeBox,
    {
        if self.static_children.is_empty() && self.static_keys.len() < 4 {
            if let Some(pos) = self.static_keys.iter().position(|k| k == &key) {
                return self.static_vals[pos].as_mut();
            }
            self.static_keys.push(key);
            self.static_vals.push(alloc());
            let last = self.static_vals.len() - 1;
            return self.static_vals[last].as_mut();
        }
        if self.static_children.is_empty() && !self.static_keys.is_empty() {
            for (k, v) in self.static_keys.drain(..).zip(self.static_vals.drain(..)) {
                self.static_children.insert(k, v);
            }
        }
        self.static_children
            .entry(key)
            .or_insert_with(alloc)
            .as_mut()
    }

    #[inline]
    pub(super) fn rebuild_pattern_index(&mut self) {
        self.pattern_first_literal.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first() {
                let entry = self
                    .pattern_first_literal
                    .entry(l0.clone())
                    .or_insert_with(SmallVec::new);
                entry.push(idx);
            }
        }
    }

    #[inline]
    pub(super) fn rebuild_pattern_meta(&mut self) {
        self.pattern_scores.clear();
        self.pattern_scores.reserve(self.patterns.len());
        for pat in self.patterns.iter() {
            self.pattern_scores.push(pattern_score(pat));
        }
        // rebuild shape groups
        self.pattern_shape_index.clear();
        self.pattern_shape_weak_index.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            let key = pattern_shape_key(pat);
            self.pattern_shape_index.entry(key).or_default().push(idx);
            let wkey = pattern_shape_weak_key(pat);
            self.pattern_shape_weak_index
                .entry(wkey)
                .or_default()
                .push(idx);
        }
        debug_assert_eq!(self.patterns.len(), self.pattern_scores.len());
    }

    /// Rebuild only shape indexes without touching scores.
    #[inline]
    pub(super) fn rebuild_shape_indices(&mut self) {
        self.pattern_shape_index.clear();
        self.pattern_shape_weak_index.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            let key = pattern_shape_key(pat);
            self.pattern_shape_index.entry(key).or_default().push(idx);
            let wkey = pattern_shape_weak_key(pat);
            self.pattern_shape_weak_index
                .entry(wkey)
                .or_default()
                .push(idx);
        }
    }

    #[inline(always)]
    pub(super) fn pattern_candidates_for(&self, comp: &str) -> SmallVec<[usize; 8]> {
        let mut out: SmallVec<[usize; 8]> = SmallVec::new();
        // exact literal key
        if let Some(v) = self.pattern_first_literal.get(comp) {
            self.pfl_hits.fetch_add(1, Ordering::Relaxed);
            for &i in v.iter() {
                out.push(i);
            }
            return out;
        }
        // prefix matches in global order by walking pattern_children
        for (idx, pat) in self.patterns.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first()
                && comp.len() >= l0.len()
                && &comp[..l0.len()] == l0.as_str()
            {
                out.push(idx);
            }
        }
        out
    }
}

// removed unused helper methods
