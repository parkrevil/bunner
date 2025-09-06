use super::NodeBox;
use aho_corasick::AhoCorasick;
use core::sync::atomic::{AtomicU64, Ordering};
use hashbrown::HashMap as FastHashMap;
use parking_lot::RwLock;
use smallvec::SmallVec;

use crate::router::interner::Interner;
use crate::router::pattern::{pattern_score, pattern_shape_key, SegmentPart, SegmentPattern};

use super::METHOD_COUNT;

// Reduce type complexity via clear aliases and small structs
pub(super) type CandidateIndices = SmallVec<[usize; 32]>;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) struct CandKey {
    pub h: u64,
    pub len_bucket: usize,
    pub midx: usize,
    pub head: u8,
    pub tail: u8,
    pub flags: u8,
}

type CandEntry = (CandKey, CandidateIndices, u64);

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
    pub(super) pattern_first_literal: FastHashMap<String, SmallVec<[usize; 16]>>,
    // first literal head byte -> indices (fast prefix filtering)
    pub(super) pattern_first_lit_head: FastHashMap<u8, SmallVec<[usize; 16]>>,
    // second literal head byte (when first part is Param and second is Literal) -> indices
    pub(super) pattern_second_lit_head: FastHashMap<u8, SmallVec<[usize; 16]>>,
    // third literal head byte (Param-Lit-Param-Lit) -> indices
    pub(super) pattern_third_lit_head: FastHashMap<u8, SmallVec<[usize; 16]>>,
    // last literal tail byte -> indices (fast suffix filtering)
    pub(super) pattern_last_lit_tail: FastHashMap<u8, SmallVec<[usize; 16]>>,
    // param-first patterns (indices) for quick fallback without full scan
    pub(super) pattern_param_first: SmallVec<[usize; 16]>,
    // cached specificity scores aligned with pattern_children
    pub(super) pattern_scores: SmallVec<[usize; 32]>,
    // cached minimal segment length required by pattern
    pub(super) pattern_min_len: SmallVec<[usize; 32]>,
    // cached last literal length (0 if none)
    pub(super) pattern_last_lit_len: SmallVec<[usize; 32]>,
    // group indices by shape key to reduce linear scans on insert
    pub(super) pattern_shape_index: FastHashMap<u64, SmallVec<[usize; 16]>>,
    // removed weak shape index for simplicity
    // lightweight metrics (Relaxed) for tuning
    pub(super) pfl_hits: AtomicU64,
    pub(super) shape_hits: AtomicU64,
    pub(super) shape_misses: AtomicU64,
    // node-local candidate stats for adaptive Top-K
    pub(super) cand_total_node: AtomicU64,
    pub(super) cand_samples_node: AtomicU64,
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
    // small per-node candidate cache: ((hash,len_bucket,method,head,tail,flags), indices, recency)
    pub(super) cand_cache: RwLock<SmallVec<[CandEntry; 16]>>,
    // static keys lower_bound search hint
    pub(super) static_lb_hint: usize,
    // Optional AC automaton for first-literal prefixes (built for large literal sets)
    pub(super) ac_first_literals: Option<AhoCorasick>,
    // Map from AC pattern id to pattern indices
    pub(super) ac_first_map: Vec<SmallVec<[usize; 8]>>,
}

impl RadixNode {
    #[inline]
    pub(super) fn cand_cache_get(&self, key: CandKey) -> Option<CandidateIndices> {
        if let Some(res) = {
            if let Some(guard) = self.cand_cache.try_read() {
                let mut found: Option<CandidateIndices> = None;
                for entry in guard.iter() {
                    if entry.0 == key {
                        found = Some(entry.1.clone());
                        break;
                    }
                }
                found
            } else {
                None
            }
        } {
            return Some(res);
        }
        // upgrade path: bump recency if we choose to; keep simple for now
        None
    }

    #[inline]
    pub(super) fn cand_cache_put(&self, key: CandKey, cand: &[usize]) {
        if let Some(mut guard) = self.cand_cache.try_write() {
            let mut max_tick = 0u64;
            for e in guard.iter() {
                if e.2 > max_tick {
                    max_tick = e.2;
                }
            }
            for entry in guard.iter_mut() {
                if entry.0 == key {
                    entry.1.clear();
                    entry.1.extend_from_slice(cand);
                    entry.2 = max_tick + 1;
                    return;
                }
            }
            let mut v: SmallVec<[usize; 32]> = SmallVec::new();
            v.extend_from_slice(cand);
            if guard.len() >= 16 {
                let mut oldest = 0usize;
                let mut oldest_tick = u64::MAX;
                for (i, e) in guard.iter().enumerate() {
                    if e.2 < oldest_tick {
                        oldest_tick = e.2;
                        oldest = i;
                    }
                }
                guard.remove(oldest);
            }
            guard.push((key, v, max_tick + 1));
        }
        // fallback: if contended, skip caching to avoid blocking
    }
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
        self.pattern_second_lit_head.clear();
        self.pattern_third_lit_head.clear();
        self.pattern_last_lit_tail.clear();
        self.pattern_param_first.clear();
        self.head_bits = [0; 4];
        self.tail_bits = [0; 4];
        self.ac_first_literals = None;
        self.ac_first_map.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first() {
                let entry = self
                    .pattern_first_literal
                    .entry(l0.clone())
                    .or_insert_with(SmallVec::new);
                entry.push(idx);
                if let Some(&b) = l0.as_bytes().first() {
                    let entry2 = self
                        .pattern_first_lit_head
                        .entry(b)
                        .or_insert_with(SmallVec::new);
                    entry2.push(idx);
                    let blk = (b as usize) >> 6;
                    let bit = 1u64 << ((b as usize) & 63);
                    self.head_bits[blk] |= bit;
                }
            } else if pat.parts.len() >= 2 {
                if let (SegmentPart::Param { .. }, SegmentPart::Literal(l1)) =
                    (&pat.parts[0], &pat.parts[1])
                    && let Some(&b) = l1.as_bytes().first()
                {
                    let entry = self
                        .pattern_second_lit_head
                        .entry(b)
                        .or_insert_with(SmallVec::new);
                    entry.push(idx);
                }
                if pat.parts.len() >= 4
                    && let (
                        SegmentPart::Param { .. },
                        SegmentPart::Literal(_l1),
                        SegmentPart::Param { .. },
                        SegmentPart::Literal(l3),
                    ) = (&pat.parts[0], &pat.parts[1], &pat.parts[2], &pat.parts[3])
                {
                    if let Some(&b) = l3.as_bytes().first() {
                        let entry = self
                            .pattern_third_lit_head
                            .entry(b)
                            .or_insert_with(SmallVec::new);
                        entry.push(idx);
                    }
                    if let Some(&tb) = l3.as_bytes().last() {
                        let e = self
                            .pattern_last_lit_tail
                            .entry(tb)
                            .or_insert_with(SmallVec::new);
                        e.push(idx);
                        let blk = (tb as usize) >> 6;
                        let bit = 1u64 << ((tb as usize) & 63);
                        self.tail_bits[blk] |= bit;
                    }
                }
                if let SegmentPart::Param { .. } = &pat.parts[0] {
                    self.pattern_param_first.push(idx);
                }
            } else if let Some(SegmentPart::Param { .. }) = pat.parts.first() {
                self.pattern_param_first.push(idx);
            }
            // also index last literal for literal-first single literal patterns
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
                e.push(idx);
                let blk = (tb as usize) >> 6;
                let bit = 1u64 << ((tb as usize) & 63);
                self.tail_bits[blk] |= bit;
            }
        }
        // Build AC automaton for first-literal prefixes when there are many distinct literals
        if self.pattern_first_literal.len() >= 16 {
            let mut lits: Vec<String> = Vec::with_capacity(self.pattern_first_literal.len());
            let mut maps: Vec<SmallVec<[usize; 8]>> =
                Vec::with_capacity(self.pattern_first_literal.len());
            for (lit, idxs) in self.pattern_first_literal.iter() {
                lits.push(lit.clone());
                let mut v: SmallVec<[usize; 8]> = SmallVec::new();
                v.extend_from_slice(idxs.as_slice());
                maps.push(v);
            }
            if let Ok(ac) = AhoCorasick::new(&lits) {
                self.ac_first_literals = Some(ac);
                self.ac_first_map = maps;
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
            // compute minimal segment length: sum of literal lengths + 1 per param
            let mut min_len = 0usize;
            for part in pat.parts.iter() {
                match part {
                    SegmentPart::Literal(l) => {
                        min_len += l.len();
                    }
                    // Param may match empty; be conservative (0)
                    SegmentPart::Param { .. } => { /* 0 */ }
                }
            }
            self.pattern_min_len.push(min_len);
            // last literal length
            let mut last_len = 0usize;
            for part in pat.parts.iter().rev() {
                if let SegmentPart::Literal(l) = part {
                    last_len = l.len();
                    break;
                }
            }
            self.pattern_last_lit_len.push(last_len);
        }
        // rebuild shape groups
        self.pattern_shape_index.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            let key = pattern_shape_key(pat);
            self.pattern_shape_index.entry(key).or_default().push(idx);
        }
        debug_assert_eq!(self.patterns.len(), self.pattern_scores.len());
        debug_assert_eq!(self.patterns.len(), self.pattern_min_len.len());
        debug_assert_eq!(self.patterns.len(), self.pattern_last_lit_len.len());
    }

    /// Rebuild only shape indexes without touching scores.
    #[inline]
    pub(super) fn rebuild_shape_indices(&mut self) {
        self.pattern_shape_index.clear();
        for (idx, pat) in self.patterns.iter().enumerate() {
            let key = pattern_shape_key(pat);
            self.pattern_shape_index.entry(key).or_default().push(idx);
        }
    }

    #[inline(always)]
    pub(super) fn pattern_candidates_for(&self, comp: &str) -> SmallVec<[usize; 8]> {
        let mut out: SmallVec<[usize; 8]> = SmallVec::new();
        // AC-based multi-prefix fast path
        if let Some(ac) = self.ac_first_literals.as_ref() {
            for m in ac.find_overlapping_iter(comp) {
                if m.start() == 0
                    && let Some(v) = self.ac_first_map.get(m.pattern().as_usize())
                {
                    for &i in v.iter() {
                        out.push(i);
                    }
                }
            }
            if !out.is_empty() {
                return out;
            }
        }
        // exact literal key
        if let Some(v) = self.pattern_first_literal.get(comp) {
            self.pfl_hits.fetch_add(1, Ordering::Relaxed);
            for &i in v.iter() {
                out.push(i);
            }
            return out;
        }
        // head-byte prefilter for literal-first patterns
        if let Some(&b) = comp.as_bytes().first()
            && let Some(v) = self.pattern_first_lit_head.get(&b)
        {
            for &i in v.iter() {
                // extra check to ensure prefix actually matches
                if let Some(SegmentPart::Literal(l0)) =
                    self.patterns.get(i).and_then(|p| p.parts.first())
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
