use super::NodeBox;
use hashbrown::HashMap as FastHashMap;
use smallvec::SmallVec;

use crate::router::interner::Interner;
use crate::router::pattern::{pattern_score, SegmentPart, SegmentPattern};

use super::METHOD_COUNT;

pub(super) type StaticMap = FastHashMap<String, NodeBox>;
pub(super) type StaticMapIdx = FastHashMap<String, super::NodeBox>;

#[derive(Debug, Default)]
pub struct RadixNode {
    // optimize small number of siblings before promoting to map
    pub(super) static_keys: SmallVec<[String; 16]>,
    pub(super) static_keys_lower: SmallVec<[String; 16]>,
    pub(super) static_vals: SmallVec<[NodeBox; 16]>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(super) static_vals_idx: SmallVec<[super::NodeBox; 16]>,
    // interned ids aligned with static_keys
    pub(super) static_key_ids: SmallVec<[u32; 16]>,
    pub(super) static_children: StaticMap,
    pub(super) static_children_idx: StaticMapIdx,
    // id-keyed mirror for static children
    pub(super) static_children_idx_ids: FastHashMap<u32, super::NodeBox>,
    // simple MPHF-like open-addressing table for static_keys (built when many keys)
    pub(super) static_hash_seed: u64,
    pub(super) static_hash_table: SmallVec<[i32; 32]>, // stores index into static_vals_idx/static_keys, -1 means empty
    // SoA: separate pattern specs and node handles
    pub(super) patterns: SmallVec<[SegmentPattern; 4]>,
    pub(super) pattern_nodes: SmallVec<[NodeBox; 4]>,
    // ordered view indices for fast iteration
    pub(super) pattern_children_idx: SmallVec<[usize; 16]>,
    // first literal -> indices in pattern_children (to reduce regex calls)
    pub(super) pattern_first_literal: FastHashMap<String, SmallVec<[u16; 16]>>,
    // first literal head byte -> indices (fast prefix filtering)
    pub(super) pattern_first_lit_head: FastHashMap<u8, SmallVec<[u16; 16]>>,
    // last literal tail byte -> indices (fast suffix filtering)
    pub(super) pattern_last_lit_tail: FastHashMap<u8, SmallVec<[u16; 16]>>,
    // param-first patterns (indices) for quick fallback without full scan
    pub(super) pattern_param_first: SmallVec<[u16; 16]>,
    // cached specificity scores aligned with pattern_children
    pub(super) pattern_scores: SmallVec<[u16; 32]>,
    // cached minimal segment length required by pattern
    pub(super) pattern_min_len: SmallVec<[u16; 32]>,
    // cached last literal length (0 if none)
    pub(super) pattern_last_lit_len: SmallVec<[u16; 32]>,
    pub(super) routes: [u16; METHOD_COUNT],
    pub(super) wildcard_routes: [u16; METHOD_COUNT],
    pub(super) sealed: bool,
    pub(super) dirty: bool,
    // prefix compression (set by compress())
    pub(super) fused_edge: Option<String>,
    pub(super) fused_child: Option<NodeBox>,
    // index-based mirror for arena-backed nodes (built during sealing)
    pub(super) fused_child_idx: Option<super::NodeBox>,
    // bitmask of methods present in this subtree (including this node)
    pub(super) method_mask: u8,
    // quick head/tail literal bitsets (256 bits each)
    pub(super) head_bits: [u64; 4],
    pub(super) tail_bits: [u64; 4],
    // static keys lower_bound search hint
    pub(super) static_lb_hint: usize,
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
        // MPHF-like quick path
        if !self.static_hash_table.is_empty()
            && self.static_vals_idx.len() == self.static_keys.len()
        {
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
        if let Some(nb) = self.static_children_idx.get(key) {
            return Some(nb.as_ref());
        }
        if !self.static_keys.is_empty() && self.static_vals_idx.len() == self.static_keys.len() {
            // small-N linear scan is often faster than binary search
            if self.static_keys.len() <= 12 {
                if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
                    return Some(self.static_vals_idx[pos].as_ref());
                }
            } else {
                // binary search on sorted static_keys with lower_bound hint
                let mut lo = 0usize;
                let mut hi = self.static_keys.len();
                if self.static_lb_hint < hi {
                    // narrow window around last hit
                    let hint = self.static_lb_hint;
                    // expand by powers of two to bracket the key
                    let mut l = hint;
                    let mut r = hint + 1;
                    while l > 0 && self.static_keys[l - 1].as_str() > key {
                        l = l.saturating_sub(2);
                    }
                    while r < hi && self.static_keys[r].as_str() < key {
                        r = (r + 2).min(hi);
                    }
                    lo = l;
                    hi = r;
                }
                while lo < hi {
                    let mid = (lo + hi) >> 1;
                    let cmp = self.static_keys[mid].as_str().cmp(key);
                    if cmp.is_lt() {
                        lo = mid + 1;
                    } else if cmp.is_gt() {
                        hi = mid;
                    } else {
                        // update hint
                        // SAFETY: mid < len
                        // This hint is best-effort; races are benign as read-only here
                        // (mutable updates happen during seal/insert phases only)
                        // Using Relaxed semantics via plain store
                        // self.static_lb_hint = mid; // field is not atomic but only used in reads in find path; writes are rare
                        // However, &self is immutable; keep as interior mutable via cell if needed. For now, skip update.
                        return Some(self.static_vals_idx[mid].as_ref());
                    }
                }
            }
        }
        None
    }

    #[inline(always)]
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
        self.static_keys_lower.clear();
        self.static_hash_table.clear();
        self.static_hash_seed = 0;
        if !self.static_keys.is_empty() {
            self.static_key_ids.reserve(self.static_keys.len());
            for k in self.static_keys.iter() {
                self.static_key_ids.push(interner.intern(k.as_str()));
                self.static_keys_lower.push(k.to_ascii_lowercase());
            }
            // Build MPHF-like table when many keys
            if self.static_vals_idx.len() == self.static_keys.len() && self.static_keys.len() >= 16
            {
                let mut size: usize = (self.static_keys.len() * 2).next_power_of_two();
                let max_size: usize = self.static_keys.len() * 8;
                let mut seed: u64 = 1469598103934665603;
                while size <= max_size {
                    let mut table: Vec<i32> = vec![-1; size];
                    let mut ok = true;
                    for (i, k) in self.static_keys.iter().enumerate() {
                        let mut h: u64 = seed;
                        for &b in k.as_bytes() {
                            h ^= b as u64;
                            h = h.wrapping_mul(1099511628211);
                        }
                        let mut idx = (h as usize) & (size - 1);
                        let mut steps = 0usize;
                        while table[idx] != -1 {
                            idx = (idx + 1) & (size - 1);
                            steps += 1;
                            if steps > size {
                                ok = false;
                                break;
                            }
                        }
                        if !ok {
                            break;
                        }
                        table[idx] = i as i32;
                    }
                    if ok {
                        self.static_hash_seed = seed;
                        self.static_hash_table.clear();
                        self.static_hash_table.extend_from_slice(&table);
                        break;
                    }
                    seed = seed
                        .wrapping_mul(1315423911)
                        .wrapping_add(0x9e3779b97f4a7c15);
                    size *= 2;
                }
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
        self.pattern_first_lit_head.clear();
        self.pattern_last_lit_tail.clear();
        self.pattern_param_first.clear();
        self.head_bits = [0; 4];
        self.tail_bits = [0; 4];

        for (idx, pat) in self.patterns.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first() {
                let entry = self
                    .pattern_first_literal
                    .entry(l0.clone())
                    .or_insert_with(SmallVec::new);
                entry.push(idx as u16);
                if let Some(&b) = l0.as_bytes().first() {
                    let entry2 = self
                        .pattern_first_lit_head
                        .entry(b)
                        .or_insert_with(SmallVec::new);
                    entry2.push(idx as u16);
                    let blk = (b as usize) >> 6;
                    let bit = 1u64 << ((b as usize) & 63);
                    self.head_bits[blk] |= bit;
                }
            } else if let Some(SegmentPart::Param { .. }) = pat.parts.first() {
                self.pattern_param_first.push(idx as u16);
            }

            if let Some(tb) = pat.parts.iter().rev().find_map(|p| {
                if let SegmentPart::Literal(s) = p {
                    s.as_bytes().last().copied()
                } else {
                    None
                }
            }) {
                let e = self
                    .pattern_last_lit_tail
                    .entry(tb)
                    .or_insert_with(SmallVec::new);
                e.push(idx as u16);
                let blk = (tb as usize) >> 6;
                let bit = 1u64 << ((tb as usize) & 63);
                self.tail_bits[blk] |= bit;
            }
        }
    }

    #[inline]
    pub(super) fn rebuild_pattern_meta(&mut self) {
        self.pattern_scores.clear();
        self.pattern_min_len.clear();
        self.pattern_last_lit_len.clear();
        self.pattern_scores.reserve(self.patterns.len());
        self.pattern_min_len.reserve(self.patterns.len());
        self.pattern_last_lit_len.reserve(self.patterns.len());

        for pat in self.patterns.iter() {
            self.pattern_scores.push(pattern_score(pat));

            let mut min_len = 0u16;

            for part in pat.parts.iter() {
                match part {
                    SegmentPart::Literal(l) => {
                        min_len += l.len() as u16;
                    }
                    SegmentPart::Param { .. } => {}
                }
            }

            self.pattern_min_len.push(min_len);

            let mut last_len = 0u16;

            for part in pat.parts.iter().rev() {
                if let SegmentPart::Literal(l) = part {
                    last_len = l.len() as u16;

                    break;
                }
            }

            self.pattern_last_lit_len.push(last_len);
        }
        debug_assert_eq!(self.patterns.len(), self.pattern_scores.len());
        debug_assert_eq!(self.patterns.len(), self.pattern_min_len.len());
        debug_assert_eq!(self.patterns.len(), self.pattern_last_lit_len.len());
    }

    #[inline(always)]
    pub(super) fn pattern_candidates_for(&self, comp: &str) -> SmallVec<[u16; 8]> {
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
}

// removed unused helper methods
