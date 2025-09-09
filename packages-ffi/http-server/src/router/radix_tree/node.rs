use super::NodeBox;
use bitflags::bitflags;
use hashbrown::HashMap as FastHashMap;
use smallvec::SmallVec;

use crate::router::pattern::{SegmentPart, SegmentPattern};

use super::HTTP_METHOD_COUNT;

pub const MAX_SEGMENT_LENGTH: usize = 255;

#[repr(C, packed)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PatternMeta {
    pub score: u16,
    pub min_len: u8,
    pub last_lit_len: u8,
}

impl PatternMeta {
    pub fn new(score: u16, min_len: u16, last_lit_len: u16) -> Self {
        Self {
            score,
            min_len: min_len as u8,
            last_lit_len: last_lit_len as u8,
        }
    }

    pub fn is_valid_length(min_len: u16, last_lit_len: u16) -> bool {
        is_valid_segment_length(min_len as usize) && is_valid_segment_length(last_lit_len as usize)
    }
}

pub fn is_valid_segment_length(len: usize) -> bool {
    len <= MAX_SEGMENT_LENGTH
}

bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
    pub struct NodeFlags: u8 {
        const SEALED = 0b00000001;
        const DIRTY = 0b00000010;
    }
}

pub(super) type StaticMap = FastHashMap<String, NodeBox>;
pub(super) type StaticMapIdx = FastHashMap<String, super::NodeBox>;

#[derive(Debug, Default)]
pub struct RadixTreeNode {
    // optimize small number of siblings before promoting to map
    pub(crate) static_keys: SmallVec<[String; 16]>,
    pub(crate) static_vals: SmallVec<[NodeBox; 16]>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(crate) static_vals_idx: SmallVec<[super::NodeBox; 16]>,
    // interned ids aligned with static_keys
    pub(super) static_key_ids: SmallVec<[u32; 16]>,
    pub(crate) static_children: StaticMap,
    pub(crate) static_children_idx: StaticMapIdx,
    // id-keyed mirror for static children
    pub(super) static_children_idx_ids: FastHashMap<u32, super::NodeBox>,
    // simple MPHF-like open-addressing table for static_keys (built when many keys)
    pub(super) static_hash_seed: u64,
    pub(super) static_hash_table: SmallVec<[i32; 32]>, // stores index into static_vals_idx/static_keys, -1 means empty
    // SoA: separate pattern specs and node handles
    pub(crate) patterns: SmallVec<[SegmentPattern; 4]>,
    pub(crate) pattern_nodes: SmallVec<[NodeBox; 4]>,
    // ordered view indices for fast iteration
    pub(super) pattern_children_idx: SmallVec<[usize; 16]>,
    // first literal -> indices in pattern_children (to reduce regex calls)
    pub(super) pattern_first_literal: FastHashMap<String, SmallVec<[u16; 16]>>,
    // first literal head byte -> indices (fast prefix filtering)
    pub(super) pattern_first_lit_head: FastHashMap<u8, SmallVec<[u16; 16]>>,
    // param-first patterns (indices) for quick fallback without full scan
    pub(super) pattern_param_first: SmallVec<[u16; 16]>,
    // 압축된 패턴 메타데이터 (기존 3개 SmallVec을 1개로 통합)
    pub(super) pattern_meta: SmallVec<[PatternMeta; 4]>,
    pub(crate) routes: [u16; HTTP_METHOD_COUNT],
    pub(crate) wildcard_routes: [u16; HTTP_METHOD_COUNT],
    pub(super) flags: NodeFlags,
    // bitmask of methods present in this subtree (including this node)
    pub(super) method_mask: u8,
    // prefix compression (set by compress())
    pub(crate) fused_edge: Option<String>,
    pub(crate) fused_child: Option<NodeBox>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(super) fused_child_idx: Option<super::NodeBox>,
}

impl RadixTreeNode {
    // Flag accessor methods
    #[inline(always)]
    pub(super) fn is_sealed(&self) -> bool {
        self.flags.contains(NodeFlags::SEALED)
    }

    #[inline(always)]
    pub(super) fn set_sealed(&mut self, sealed: bool) {
        self.flags.set(NodeFlags::SEALED, sealed);
    }

    #[inline(always)]
    pub(super) fn is_dirty(&self) -> bool {
        self.flags.contains(NodeFlags::DIRTY)
    }

    #[inline(always)]
    pub(super) fn set_dirty(&mut self, dirty: bool) {
        self.flags.set(NodeFlags::DIRTY, dirty);
    }

    #[inline(always)]
    pub(super) fn method_mask(&self) -> u8 {
        self.method_mask
    }

    #[inline(always)]
    pub(super) fn set_method_mask(&mut self, mask: u8) {
        self.method_mask = mask;
    }

    #[inline(always)]
    pub(super) fn get_static_child(
        &self,
        key: &str,
        key_id: Option<u32>,
    ) -> Option<&RadixTreeNode> {
        // --- Fast path for sealed/indexed nodes ---
        if !self.static_vals_idx.is_empty() {
            if let Some(id) = key_id {
                if let Some(node) = self.static_children_idx_ids.get(&id) {
                    return Some(node.as_ref());
                }
                if !self.static_key_ids.is_empty()
                    && let Ok(pos) = self.static_key_ids.binary_search(&id)
                {
                    return Some(self.static_vals_idx[pos].as_ref());
                }
            }

            if !self.static_hash_table.is_empty() {
                let size = self.static_hash_table.len();
                let mut h: u64 = self.static_hash_seed;
                for &b in key.as_bytes() {
                    h ^= b as u64;
                    h = h.wrapping_mul(1099511628211);
                }
                let mut idx = (h as usize) & (size - 1);
                let mut steps = 0usize;
                while steps < size {
                    let pos = self.static_hash_table[idx];
                    if pos == -1 {
                        break;
                    }
                    let p = pos as usize;
                    if self.static_keys[p].as_str() == key {
                        return Some(self.static_vals_idx[p].as_ref());
                    }
                    idx = (idx + 1) & (size - 1);
                    steps += 1;
                }
            }

            if let Some(node) = self.static_children_idx.get(key) {
                return Some(node.as_ref());
            }

            if self.static_keys.len() <= 12 {
                if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
                    return Some(self.static_vals_idx[pos].as_ref());
                }
            } else if let Ok(pos) = self.static_keys.binary_search_by(|k| k.as_str().cmp(key)) {
                return Some(self.static_vals_idx[pos].as_ref());
            }

            return None; // Indexed node, but not found
        }

        // --- Slow path for non-sealed/unindexed nodes ---
        if let Some(n) = self.static_children.get(key) {
            return Some(n.as_ref());
        }
        if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
            return Some(self.static_vals[pos].as_ref());
        }

        None
    }

    /// Same as `descend_static_mut` but uses provided allocator for child creation.
    pub(super) fn descend_static_mut_with_alloc<F>(
        &mut self,
        key: String,
        alloc: F,
    ) -> &mut RadixTreeNode
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
    pub(super) fn pattern_candidates_for(&self, comp: &str) -> SmallVec<[u16; 8]> {
        debug_assert!(comp.is_ascii());
        let mut out: SmallVec<[u16; 8]> = SmallVec::new();

        if let Some(v) = self.pattern_first_literal.get(comp) {
            for &i in v.iter() {
                out.push(i);
            }
            return out;
        }

        if let Some(&b) = comp.as_bytes().first()
            && let Some(v) = self.pattern_first_lit_head.get(&b)
        {
            for &i in v.iter() {
                if let Some(SegmentPart::Literal(l0)) =
                    self.patterns.get(i as usize).and_then(|p| p.parts.first())
                    && comp.len() >= l0.len()
                    && &comp[..l0.len()] == l0.as_str()
                {
                    out.push(i);
                }
            }

            if !out.is_empty() {
                return out;
            }
        }

        for (idx, pat) in self.patterns.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first()
                && comp.len() >= l0.len()
                && &comp[..l0.len()] == l0.as_str()
            {
                out.push(idx as u16);
            }
        }
        out
    }

    #[cfg(feature = "test")]
    pub fn get_child_for_test(&self, key: &str) -> Option<&RadixTreeNode> {
        // After finalize, children are in static_keys and static_vals_idx for binary search
        if let Ok(pos) = self.static_keys.binary_search_by(|k| k.as_str().cmp(key)) {
            return Some(self.static_vals[pos].as_ref());
        }
        None
    }

    #[cfg(feature = "test")]
    pub fn get_static_keys_for_test(&self) -> &SmallVec<[String; 16]> {
        &self.static_keys
    }
}
