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
                let ok = {
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
            let comp_cow: Cow<str> = Cow::Borrowed(seg);

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
                    return Some(ok);
                }
            }

            if let Some(nb) = cur.get_static_fast(comp) {
                prefetch_node(nb);

                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_from] static_fast HIT comp={}", comp);
                }

                if let Some(ok) = self.find_from(nb, method, s, i, params) {
                    return Some(ok);
                }
            }
            
            if let Some(next) = cur.get_static_ref(comp) {
                prefetch_node(next);

                if crate::router::router_debug_enabled() {
                    eprintln!("[router.find_from] static_ref HIT comp={}", comp);
                }

                if let Some(ok) = self.find_from(next, method, s, i, params) {
                    return Some(ok);
                }
            }

            if !cur.static_keys.is_empty() && cur.static_vals_idx.len() == cur.static_keys.len() {
                for (k, nb) in cur.static_keys.iter().zip(cur.static_vals_idx.iter()) {
                    if k.as_str() == comp {
                        prefetch_node(nb.as_ref());

                        if let Some(ok) = self.find_from(nb.as_ref(), method, s, i, params) {
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
                    return Some(ok);
                }
            }

            let mut cand_idxs: SmallVec<[u16; 8]> = cur.pattern_candidates_for(comp);

            if cand_idxs.is_empty() {
                cand_idxs.extend((0..cur.patterns.len()).map(|i| i as u16));
            }

            let cand_len = cand_idxs.len();
            if cand_len > 1 {
                let mut scores_with_idx: SmallVec<[(u16, u16); 64]> = SmallVec::with_capacity(cand_len);
                for &i0 in cand_idxs.iter() {
                    scores_with_idx.push((
                        cur.pattern_scores.get(i0 as usize).copied().unwrap_or(0),
                        i0,
                    ));
                }
                scores_with_idx.sort_unstable_by_key(|&(s, _)| core::cmp::Reverse(s));
                cand_idxs.clear();
                for &(_, idx0) in scores_with_idx.iter() {
                    cand_idxs.push(idx0);
                }
            }

            for idx_u16 in cand_idxs {
                let idx = idx_u16 as usize;
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
                "[router.find] method={:?} path={}",
                method, path
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
            if let Some(&rk) = self.static_full_map[method_idx].get(norm_path)
             {
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
                    let hb = bs[i];

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