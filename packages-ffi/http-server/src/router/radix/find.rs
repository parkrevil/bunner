use crate::router::pattern;
use smallvec::SmallVec;
use std::borrow::Cow;

use super::RadixRouter;
use crate::r#enum::HttpMethod;

#[inline(always)]
fn prefetch_node(_n: &super::node::RadixNode) {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        let p = _n as *const _ as *const i8;
        core::arch::x86_64::_mm_prefetch(p, core::arch::x86_64::_MM_HINT_T0);
    }
}

#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
#[inline]
unsafe fn starts_with_cs_avx2(hay: &[u8], pre: &[u8]) -> bool {
    if pre.len() > hay.len() {
        return false;
    }
    let mut i = 0usize;
    while i + 32 <= pre.len() {
        let a = unsafe { core::arch::x86_64::_mm256_loadu_si256(hay.as_ptr().add(i) as *const _) };
        let b = unsafe { core::arch::x86_64::_mm256_loadu_si256(pre.as_ptr().add(i) as *const _) };
        let cmp = unsafe { core::arch::x86_64::_mm256_cmpeq_epi8(a, b) };
        let mask = unsafe { core::arch::x86_64::_mm256_movemask_epi8(cmp) as u32 };
        if mask != u32::MAX {
            return false;
        }
        i += 32;
    }
    while i < pre.len() {
        if hay[i] != pre[i] {
            return false;
        }
        i += 1;
    }
    true
}

#[inline(always)]
fn starts_with_ascii_ci(hay: &str, pre: &str) -> bool {
    let hb = hay.as_bytes();
    let pb = pre.as_bytes();
    let n = pb.len();
    if n > hb.len() {
        return false;
    }
    if n == 0 {
        return true;
    }
    // quick first-byte guard
    let a0 = hb[0];
    let b0 = pb[0];
    if !(a0 == b0 || (a0 ^ 0x20) == (b0 | 0x20)) {
        return false;
    }
    let mut i = 0usize;
    while i + 16 <= n {
        let a = &hb[i..i + 16];
        let b = &pb[i..i + 16];
        for j in 0..16 {
            if !a[j].eq_ignore_ascii_case(&b[j]) {
                return false;
            }
        }
        i += 16;
    }
    while i + 8 <= n {
        let a = &hb[i..i + 8];
        let b = &pb[i..i + 8];
        for j in 0..8 {
            if !a[j].eq_ignore_ascii_case(&b[j]) {
                return false;
            }
        }
        i += 8;
    }
    while i < n {
        if !hb[i].eq_ignore_ascii_case(&pb[i]) {
            return false;
        }
        i += 1;
    }
    true
}

impl RadixRouter {
    #[inline(always)]
    fn decode_key(stored: u16) -> u16 {
        if stored > 0 { stored - 1 } else { 0 }
    }
    #[inline(always)]
    fn skip_slashes(&self, s: &str, mut i: usize) -> usize {
        let bs = s.as_bytes();
        if i < bs.len() && bs[i] == b'/' {
            i += 1;
        }
        i
    }
    #[inline(always)]
    fn find_from(
        &self,
        node: &super::node::RadixNode,
        method: HttpMethod,
        s: &str,
        mut i: usize,
        params: &mut SmallVec<[(String, (usize, usize)); 8]>,
    ) -> Option<super::super::MatchResult> {
        let mut cur = node;
        i = self.skip_slashes(s, i);

        loop {
            if let Some(edge) = cur.fused_edge.as_ref() {
                let rem = &s[i..];
                let ok = if self.options.case_sensitive {
                    let hb = rem.as_bytes();
                    let pb = edge.as_bytes();
                    #[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
                    {
                        if pb.len() >= 32 {
                            unsafe { starts_with_cs_avx2(hb, pb) }
                        } else {
                            hb.starts_with(pb)
                        }
                    }
                    #[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
                    {
                        hb.starts_with(pb)
                    }
                } else {
                    starts_with_ascii_ci(rem, edge.as_str())
                };

                if ok {
                    let mut ni = i + edge.len();

                    ni = self.skip_slashes(s, ni);

                    if let Some(child_nb) = cur.fused_child_idx.as_ref() {
                        cur = child_nb.as_ref();
                        i = ni;

                        continue;
                    }

                    if let Some(child) = cur.fused_child.as_ref() {
                        cur = child.as_ref();
                        i = ni;

                        continue;
                    }
                } else {
                    #[cold]
                    fn miss_fused() -> Option<super::super::MatchResult> {
                        None
                    }

                    return miss_fused();
                }
            }

            let method_idx = method as usize;
            let wildcard_key = cur.wildcard_routes[method_idx];

            if i >= s.len() {
                let rk = cur.routes[method_idx];

                if rk != 0 {
                    let out_params = core::mem::take(params).into_vec();

                    return Some(super::super::MatchResult {
                        key: Self::decode_key(rk),
                        params: out_params,
                    });
                }

                if wildcard_key != 0 {
                    let out_params = core::mem::take(params).into_vec();

                    return Some(super::super::MatchResult {
                        key: Self::decode_key(wildcard_key),
                        params: out_params,
                    });
                }

                #[cold]
                fn miss() -> Option<super::super::MatchResult> {
                    None
                }
                return miss();
            }

            if self.root.sealed && (cur.method_mask & super::METHOD_BIT[method_idx]) == 0 {
                #[cold]
                fn miss_method() -> Option<super::super::MatchResult> {
                    None
                }

                return miss_method();
            }

            let start = i;

            if let Some(pos) = memchr::memchr(b'/', &s.as_bytes()[i..]) {
                i += pos;
            } else {
                i = s.len();
            }

            let seg = &s[start..i];
            let comp_cow: Cow<str> = if self.options.case_sensitive {
                Cow::Borrowed(seg)
            } else {
                Cow::Owned(seg.to_ascii_lowercase())
            };

            let comp: &str = comp_cow.as_ref();

            if let Some(key_id) = self.interner.get(comp)
                && let Some(nb) = cur.get_static_id_fast(key_id)
            {
                prefetch_node(nb);

                if crate::router::router_debug_enabled() {
                    eprintln!(
                        "[router.find_from] static_id_fast HIT comp={} key_id={}",
                        comp, key_id
                    );
                }

                if let Some(ok) = self.find_from(nb, method, s, i, params) {
                    self.static_hits
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                    return Some(ok);
                }
            }

            if let Some(nb) = cur.get_static_fast(comp) {
                prefetch_node(nb);

                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_from] static_fast HIT comp={}", comp);
                }

                if let Some(ok) = self.find_from(nb, method, s, i, params) {
                    self.static_hits
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                    return Some(ok);
                }
            }
            if let Some(next) = cur.get_static_ref(comp) {
                prefetch_node(next);

                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_from] static_ref HIT comp={}", comp);
                }

                if let Some(ok) = self.find_from(next, method, s, i, params) {
                    self.static_hits
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    return Some(ok);
                }
            }

            if !cur.static_keys.is_empty() && cur.static_vals_idx.len() == cur.static_keys.len() {
                for (k, nb) in cur.static_keys.iter().zip(cur.static_vals_idx.iter()) {
                    if k.as_str() == comp {
                        prefetch_node(nb.as_ref());

                        if crate::router::router_debug_enabled() {
                            eprintln!("[router.find_from] static_keys SCAN HIT comp={}", comp);
                        }

                        if let Some(ok) = self.find_from(nb.as_ref(), method, s, i, params) {
                            self.static_hits
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            return Some(ok);
                        }
                    }
                }
            }
            if !cur.static_children.is_empty()
                && let Some(nb) = cur.static_children.get(comp)
            {
                prefetch_node(nb.as_ref());

                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_from] static_children MAP HIT comp={}", comp);
                }

                if let Some(ok) = self.find_from(nb.as_ref(), method, s, i, params) {
                    self.static_hits
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                    return Some(ok);
                }
            }

            let mut cand_idxs: SmallVec<[usize; 32]> = SmallVec::new();
            let mut seen_bits: SmallVec<[u64; 4]> = {
                let blocks = cur.patterns.len().div_ceil(64);
                let mut v: SmallVec<[u64; 4]> = SmallVec::new();

                v.resize(blocks, 0);

                v
            };

            #[inline(always)]
            fn mark_if_new(bits: &mut SmallVec<[u64; 4]>, idx: usize) -> bool {
                let b = idx >> 6;
                let m = 1u64 << (idx & 63);

                if b >= bits.len() {
                    return false;
                }

                let old = bits[b];

                if (old & m) == 0 {
                    bits[b] = old | m;

                    true
                } else {
                    false
                }
            }

            if !cur.patterns.is_empty() {
                for (idx, pat) in cur.patterns.iter().enumerate() {
                    if let Some(crate::router::pattern::SegmentPart::Literal(l0)) =
                        pat.parts.first()
                        && !l0.is_empty()
                        && comp.starts_with(l0.as_str())
                    {
                        let child_nb = &cur.pattern_nodes[idx];
                        prefetch_node(child_nb.as_ref());
                        if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                            let checkpoint = params.len();
                            for (name, (off, len)) in kvs.into_iter() {
                                params.push((name, (start + off, len)));
                            }
                            if let Some(ok) =
                                self.find_from(child_nb.as_ref(), method, s, i, params)
                            {
                                return Some(ok);
                            }
                            params.truncate(checkpoint);
                        }
                    }
                }
                // Early pass B: try literal-first patterns in order of decreasing first literal length
                let mut lit_idxs: SmallVec<[(usize, usize); 32]> = SmallVec::new();
                for (idx, pat) in cur.patterns.iter().enumerate() {
                    if let Some(crate::router::pattern::SegmentPart::Literal(l0)) =
                        pat.parts.first()
                        && !l0.is_empty()
                    {
                        lit_idxs.push((l0.len(), idx));
                    }
                }
                if !lit_idxs.is_empty() {
                    lit_idxs.sort_unstable_by(|a, b| b.0.cmp(&a.0));
                    for &(_, idx) in lit_idxs.iter() {
                        let pat = &cur.patterns[idx];
                        let child_nb = &cur.pattern_nodes[idx];
                        prefetch_node(child_nb.as_ref());
                        if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                            let checkpoint = params.len();
                            for (name, (off, len)) in kvs.into_iter() {
                                params.push((name, (start + off, len)));
                            }
                            if let Some(ok) =
                                self.find_from(child_nb.as_ref(), method, s, i, params)
                            {
                                return Some(ok);
                            }
                            params.truncate(checkpoint);
                        }
                    }
                }
                // cache lookup (sealed only)
                if self.root.sealed {
                    self.cache_lookups
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    let mut h: u64 = 1469598103934665603; // FNV offset
                    for &b in comp.as_bytes() {
                        h ^= b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }
                    // bucketize length to smooth cache keys (0..8,8..16,...)
                    let len_bucket = comp.len().div_ceil(8) * 8;
                    let head_b = comp.as_bytes().first().copied().unwrap_or(0);
                    let tail_b = comp.as_bytes().last().copied().unwrap_or(0);
                    let flags =
                        (self.options.case_sensitive as u8) | ((comp.is_ascii() as u8) << 1);
                    if let Some(hit) = cur.cand_cache_get(super::node::CandKey {
                        h,
                        len_bucket,
                        midx: method_idx,
                        head: head_b,
                        tail: tail_b,
                        flags,
                    }) {
                        cand_idxs.extend(hit);
                        self.cache_hits
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    } else {
                        self.cache_misses
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                }
                if cand_idxs.is_empty() {
                    // 1) Fast path: first-literal exact/ prefix candidates
                    let first = cur.pattern_candidates_for(comp);
                    if !first.is_empty() {
                        cand_idxs.reserve_exact(first.len());
                        for i0 in first {
                            if mark_if_new(&mut seen_bits, i0) {
                                cand_idxs.push(i0);
                            }
                        }
                    } else {
                        // 2) Param-first heuristics: use second/third literal head map across unique bytes in comp
                        //    and verify the full second literal actually occurs inside comp.
                        if !comp.is_empty() {
                            // deduplicate head-byte probes using a tiny bitmap
                            let mut seen: [bool; 256] = [false; 256];
                            for &b in comp.as_bytes().iter() {
                                if seen[b as usize] {
                                    continue;
                                }
                                seen[b as usize] = true;
                                if let Some(v) = cur.pattern_second_lit_head.get(&b) {
                                    for &idx in v.iter() {
                                        if let Some(pat) = cur.patterns.get(idx)
                                            && pat.parts.len() >= 2
                                            && let (
                                                crate::router::pattern::SegmentPart::Param {
                                                    ..
                                                },
                                                crate::router::pattern::SegmentPart::Literal(l1),
                                            ) = (&pat.parts[0], &pat.parts[1])
                                            && comp.contains(l1.as_str())
                                            && mark_if_new(&mut seen_bits, idx)
                                        {
                                            cand_idxs.push(idx);
                                        }
                                    }
                                }
                                if let Some(v3) = cur.pattern_third_lit_head.get(&b) {
                                    for &idx in v3.iter() {
                                        if let Some(pat) = cur.patterns.get(idx)
                                            && pat.parts.len() >= 4
                                            && let (
                                                crate::router::pattern::SegmentPart::Param {
                                                    ..
                                                },
                                                crate::router::pattern::SegmentPart::Literal(_l1),
                                                crate::router::pattern::SegmentPart::Param {
                                                    ..
                                                },
                                                crate::router::pattern::SegmentPart::Literal(l3),
                                            ) = (
                                                &pat.parts[0],
                                                &pat.parts[1],
                                                &pat.parts[2],
                                                &pat.parts[3],
                                            )
                                            && comp.contains(l3.as_str())
                                            && mark_if_new(&mut seen_bits, idx)
                                        {
                                            cand_idxs.push(idx);
                                        }
                                    }
                                }
                            }
                        }

                        if self.root.sealed && cand_idxs.is_empty() {
                            let comp_len = comp.len();
                            let head_is_alpha = comp
                                .as_bytes()
                                .first()
                                .map(|b| b.is_ascii_alphabetic())
                                .unwrap_or(false);

                            for (idx, pat) in cur.patterns.iter().enumerate() {
                                if let Some(crate::router::pattern::SegmentPart::Literal(l0)) =
                                    pat.parts.first()
                                {
                                    if comp_len < l0.len() {
                                        continue;
                                    }

                                    let h_match = l0
                                        .as_bytes()
                                        .first()
                                        .map(|b| b.is_ascii_alphabetic())
                                        .unwrap_or(false)
                                        == head_is_alpha;

                                    if !h_match {
                                        continue;
                                    }

                                    if &comp[..l0.len()] != l0.as_str() {
                                        continue;
                                    }

                                    if mark_if_new(&mut seen_bits, idx) {
                                        cand_idxs.push(idx);
                                    }
                                } else {
                                    if let Some(crate::router::pattern::SegmentPart::Literal(l1)) =
                                        pat.parts.get(1)
                                    {
                                        if let Some(&hb) = comp.as_bytes().first()
                                            && l1.as_bytes().first().copied() == Some(hb)
                                            && mark_if_new(&mut seen_bits, idx)
                                        {
                                            cand_idxs.push(idx);
                                        }
                                    } else if mark_if_new(&mut seen_bits, idx) {
                                        cand_idxs.push(idx);
                                    }
                                }
                            }
                        }

                        if cand_idxs.is_empty() {
                            let comp_len = comp.len();

                            if let Some(&tb) = comp.as_bytes().last() {
                                if let Some(vt) = cur.pattern_last_lit_tail.get(&tb) {
                                    for &idx in vt.iter() {
                                        if comp_len >= *cur.pattern_min_len.get(idx).unwrap_or(&0)
                                            && comp_len
                                                >= *cur.pattern_last_lit_len.get(idx).unwrap_or(&0)
                                            && mark_if_new(&mut seen_bits, idx)
                                        {
                                            cand_idxs.push(idx);
                                        }
                                    }
                                }
                            }

                            if cand_idxs.is_empty() {
                                for (idx, minl) in cur.pattern_min_len.iter().enumerate() {
                                    if comp_len >= *minl && mark_if_new(&mut seen_bits, idx) {
                                        cand_idxs.push(idx);
                                    }
                                }
                            }
                        }

                        if cand_idxs.is_empty() {
                            for &idx in cur.pattern_param_first.iter() {
                                if mark_if_new(&mut seen_bits, idx) {
                                    cand_idxs.push(idx);
                                }
                            }
                        }
                    }
                }

                if cand_idxs.is_empty() {
                    for idx in 0..cur.patterns.len() {
                        if mark_if_new(&mut seen_bits, idx) {
                            cand_idxs.push(idx);
                        }
                    }
                }

                let cand_len = cand_idxs.len();

                if cand_len > 0 {
                    let total = cur.patterns.len().max(1);
                    let ns = cur
                        .cand_samples_node
                        .load(std::sync::atomic::Ordering::Relaxed);
                    let na = if ns > 0 {
                        (cur.cand_total_node
                            .load(std::sync::atomic::Ordering::Relaxed)
                            / ns) as usize
                    } else {
                        0
                    };

                    let gs = self.cand_samples.load(std::sync::atomic::Ordering::Relaxed);
                    let ga = if gs > 0 {
                        (self.cand_total.load(std::sync::atomic::Ordering::Relaxed) / gs) as usize
                    } else {
                        0
                    };
                    let avg = if na > 0 { na } else { ga };
                    let base_k = total / 4;
                    let tuned = core::cmp::max(base_k, avg.saturating_div(2));
                    let k = tuned.clamp(16, 64);

                    if cand_len > k {
                        let mut scores_with_idx: SmallVec<[(usize, usize); 64]> = SmallVec::new();

                        scores_with_idx.reserve(cand_len);

                        for &i0 in cand_idxs.iter() {
                            scores_with_idx
                                .push((cur.pattern_scores.get(i0).copied().unwrap_or(0), i0));
                        }

                        let (left, _pivot, _right) =
                            scores_with_idx.select_nth_unstable_by_key(k, |&(s, _)| s);

                        left.sort_unstable_by_key(|&(s, _)| core::cmp::Reverse(s));
                        cand_idxs.clear();

                        for &(_, idx0) in left.iter() {
                            cand_idxs.push(idx0);
                        }
                    }
                    self.cand_total
                        .fetch_add(cand_len as u64, std::sync::atomic::Ordering::Relaxed);
                    self.cand_samples
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    cur.cand_total_node
                        .fetch_add(cand_len as u64, std::sync::atomic::Ordering::Relaxed);
                    cur.cand_samples_node
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                    if let Some(mut buf) = self.cand_recent.try_lock() {
                        if buf.len() >= 512 {
                            buf.remove(0);
                        }
                        buf.push(cand_len as u16);
                    }
                }

                if self.root.sealed {
                    let mut h: u64 = 1469598103934665603;

                    for &b in comp.as_bytes() {
                        h ^= b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }

                    let len_bucket = comp.len().div_ceil(8) * 8;
                    let head_b = comp.as_bytes().first().copied().unwrap_or(0);
                    let tail_b = comp.as_bytes().last().copied().unwrap_or(0);
                    let flags =
                        (self.options.case_sensitive as u8) | ((comp.is_ascii() as u8) << 1);

                    cur.cand_cache_put(
                        super::node::CandKey {
                            h,
                            len_bucket,
                            midx: method_idx,
                            head: head_b,
                            tail: tail_b,
                            flags,
                        },
                        &cand_idxs,
                    );
                }
            }

            for idx in cand_idxs {
                if idx < cur.pattern_children_idx.len() {
                    let pat = &cur.patterns[idx];
                    let child_nb = &cur.pattern_nodes[idx];

                    prefetch_node(child_nb.as_ref());

                    if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                        let checkpoint = params.len();

                        for (name, (off, len)) in kvs.into_iter() {
                            params.push((name, (start + off, len)));
                        }

                        if let Some(ok) = self.find_from(child_nb.as_ref(), method, s, i, params) {
                            return Some(ok);
                        } else {
                            params.truncate(checkpoint);
                        }
                    }

                    continue;
                }

                let pat = &cur.patterns[idx];
                let next = &cur.pattern_nodes[idx];

                prefetch_node(next.as_ref());

                if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                    let checkpoint = params.len();

                    for (name, (off, len)) in kvs.into_iter() {
                        params.push((name, (start + off, len)));
                    }

                    if let Some(ok) = self.find_from(next.as_ref(), method, s, i, params) {
                        return Some(ok);
                    } else {
                        params.truncate(checkpoint);
                    }
                }
            }

            if !cur.patterns.is_empty() {
                for (idx, pat) in cur.patterns.iter().enumerate() {
                    let next = &cur.pattern_nodes[idx];

                    prefetch_node(next.as_ref());

                    if self.root.sealed {
                        let mask = next.as_ref().method_mask;
                        if (mask & super::METHOD_BIT[method_idx]) == 0 {
                            continue;
                        }
                    }

                    if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                        let checkpoint = params.len();

                        for (name, (off, len)) in kvs.into_iter() {
                            params.push((name, (start + off, len)));
                        }

                        if let Some(ok) = self.find_from(next.as_ref(), method, s, i, params) {
                            return Some(ok);
                        } else {
                            params.truncate(checkpoint);
                        }
                    }
                }
            }

            if wildcard_key != 0 {
                let mut cap_start = start;

                if cap_start < s.len() && s.as_bytes()[cap_start] == b'/' {
                    cap_start += 1;
                }

                let rest_len = if cap_start <= s.len() {
                    s.len() - cap_start
                } else {
                    0
                };

                if rest_len == 0 {
                    let out_params = params.clone().into_vec();

                    return Some(super::super::MatchResult {
                        key: Self::decode_key(wildcard_key),
                        params: out_params,
                    });
                } else {
                    let checkpoint = params.len();

                    params.push(("*".to_string(), (cap_start, rest_len)));

                    let out = Some(super::super::MatchResult {
                        key: Self::decode_key(wildcard_key),
                        params: params.clone().into_vec(),
                    });

                    params.truncate(checkpoint);

                    return out;
                }
            }

            #[cold]
            fn miss2() -> Option<super::super::MatchResult> {
                None
            }

            return miss2();
        }
    }

    #[inline]
    pub fn find(&self, method: HttpMethod, path: &str) -> Option<super::super::MatchResult> {
        if !path.is_ascii() {
            return None;
        }

        if crate::router::router_debug_enabled() {
            eprintln!(
                "[router.find] method={:?} path={} cs:{}",
                method, path, self.options.case_sensitive
            );
        }

        if path == "/" {
            let method_idx = method as usize;
            let key = self.root.routes[method_idx];

            if key != 0 {
                return Some(super::super::MatchResult {
                    key: Self::decode_key(key),
                    params: vec![],
                });
            }

            return None;
        }

        let norm = super::super::normalize_path(path);

        if crate::router::router_debug_enabled() {
            eprintln!("[router.find] normalized={} (from {})", norm, path);
        }

        self.find_norm(method, norm.as_str())
    }

    #[inline(always)]
    pub fn find_norm(
        &self,
        method: HttpMethod,
        norm_path: &str,
    ) -> Option<super::super::MatchResult> {
        if !norm_path.is_ascii() {
            return None;
        }

        let method_idx = method as usize;

        if norm_path.as_bytes().iter().all(|&b| b == b'/') {
            let key = self.root.routes[method_idx];
            if key != 0 {
                return Some(super::super::MatchResult {
                    key: Self::decode_key(key),
                    params: vec![],
                });
            }
            return None;
        }

        if self.root.sealed && self.enable_static_full_map {
            if let Some(&rk) = if self.options.case_sensitive {
                self.static_full_map[method_idx].get(norm_path)
            } else {
                let lower = norm_path.to_ascii_lowercase();

                self.static_full_map[method_idx].get(lower.as_str())
            } {
                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_norm] static_full_map hit key={}", rk);
                }

                return Some(super::super::MatchResult {
                    key: Self::decode_key(rk),
                    params: vec![],
                });
            }
        }

        if self.root.sealed && self.enable_root_prune {
            if !self.root_param_first_present[method_idx] && !self.root_wildcard_present[method_idx]
            {
                let bs = norm_path.as_bytes();
                let mut i = 0usize;

                while i < bs.len() && bs[i] == b'/' {
                    i += 1;
                }

                if i < bs.len() {
                    let mut hb = bs[i];

                    if !self.options.case_sensitive && hb.is_ascii_uppercase() {
                        hb |= 0x20;
                    }

                    let blk = (hb as usize) >> 6;
                    let bit = 1u64 << ((hb as usize) & 63);
                    let head_present_any = self.method_head_bits[method_idx][0]
                        | self.method_head_bits[method_idx][1]
                        | self.method_head_bits[method_idx][2]
                        | self.method_head_bits[method_idx][3];

                    if head_present_any != 0 && (self.method_head_bits[method_idx][blk] & bit) == 0
                    {
                        if crate::router::router_debug_enabled() {
                            eprintln!(
                                "[router.prune] head miss hb={} idx={} head_bits_blk={:b}",
                                hb, method_idx, self.method_head_bits[method_idx][blk]
                            );
                        }

                        return None;
                    }

                    let mut j = i;

                    while j < bs.len() && bs[j] != b'/' {
                        j += 1;
                    }

                    let seg_len = (j - i).min(63) as u32;
                    let lbit = 1u64 << seg_len;

                    if self.method_len_buckets[method_idx] != 0
                        && (self.method_len_buckets[method_idx] & lbit) == 0
                    {
                        return None;
                    }
                }
            }
        }

        if norm_path == "/" {
            let key = self.root.routes[method_idx];

            if key != 0 {
                return Some(super::super::MatchResult {
                    key: Self::decode_key(key),
                    params: vec![],
                });
            }

            return None;
        }

        let mut params: SmallVec<[(String, (usize, usize)); 8]> = SmallVec::new();

        let res = self.find_from(&self.root, method, norm_path, 0, &mut params);

        res
    }
}
