use crate::router::pattern;
use smallvec::SmallVec;
use std::borrow::Cow;

use super::RadixTreeRouter;
use crate::r#enum::HttpMethod;

#[inline(always)]
fn prefetch_node(_n: &super::node::RadixTreeNode) {
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

impl RadixTreeRouter {
    #[inline(always)]
    fn decode_route_key(stored: u16) -> u16 {
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
        node: &super::node::RadixTreeNode,
        method: HttpMethod,
        s: &str,
        mut i: usize,
        parameter_offsets: &mut SmallVec<[(String, (usize, usize)); 8]>,
    ) -> Option<super::super::RouteMatchResult> {
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
                    fn miss_fused() -> Option<super::super::RouteMatchResult> {
                        None
                    }

                    return miss_fused();
                }
            }

            let method_idx = method as usize;
            let wildcard_route_key = cur.wildcard_routes[method_idx];

            if i >= s.len() {
                let rk = cur.routes[method_idx];

                if rk != 0 {
                    let out_parameter_offsets = core::mem::take(parameter_offsets).into_vec();

                    return Some(super::super::RouteMatchResult {
                        route_key: Self::decode_route_key(rk),
                        parameter_offsets: out_parameter_offsets,
                    });
                }

                if wildcard_route_key != 0 {
                    let out_parameter_offsets = core::mem::take(parameter_offsets).into_vec();

                    return Some(super::super::RouteMatchResult {
                        route_key: Self::decode_route_key(wildcard_route_key),
                        parameter_offsets: out_parameter_offsets,
                    });
                }

                #[cold]
                fn miss() -> Option<super::super::RouteMatchResult> {
                    None
                }

                return miss();
            }

            if self.root_node.is_sealed() && (cur.method_mask() & super::HTTP_METHOD_BIT_MASKS[method_idx]) == 0 {
                #[cold]
                fn miss_method() -> Option<super::super::RouteMatchResult> {
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

            if let Some(route_key_id) = self.string_interner.get(comp)
                && let Some(nb) = cur.get_static_id_fast(route_key_id)
            {
                prefetch_node(nb);

                if let Some(ok) = self.find_from(nb, method, s, i, parameter_offsets) {
                    return Some(ok);
                }
            }

            if let Some(nb) = cur.get_static_fast(comp) {
                prefetch_node(nb);

                if let Some(ok) = self.find_from(nb, method, s, i, parameter_offsets) {
                    return Some(ok);
                }
            }
            
            if let Some(next) = cur.get_static_ref(comp) {
                prefetch_node(next);

                if let Some(ok) = self.find_from(next, method, s, i, parameter_offsets) {
                    return Some(ok);
                }
            }

            if !cur.static_keys.is_empty() && cur.static_vals_idx.len() == cur.static_keys.len() {
                for (k, nb) in cur.static_keys.iter().zip(cur.static_vals_idx.iter()) {
                    if k.as_str() == comp {
                        prefetch_node(nb.as_ref());

                        if let Some(ok) = self.find_from(nb.as_ref(), method, s, i, parameter_offsets) {
                            return Some(ok);
                        }
                    }
                }
            }

            if !cur.static_children.is_empty()
                && let Some(nb) = cur.static_children.get(comp)
            {
                prefetch_node(nb.as_ref());

                if let Some(ok) = self.find_from(nb.as_ref(), method, s, i, parameter_offsets) {
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
                        let checkpoint = parameter_offsets.len();

                        for (name, (off, len)) in kvs.into_iter() {
                            parameter_offsets.push((name, (start + off, len)));
                        }

                        if let Some(ok) = self.find_from(child_nb.as_ref(), method, s, i, parameter_offsets) {
                            return Some(ok);
                        } else {
                            parameter_offsets.truncate(checkpoint);
                        }
                    }

                    continue;
                }

                let pat = &cur.patterns[idx];
                let next = &cur.pattern_nodes[idx];

                prefetch_node(next.as_ref());

                if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                    let checkpoint = parameter_offsets.len();

                    for (name, (off, len)) in kvs.into_iter() {
                        parameter_offsets.push((name, (start + off, len)));
                    }

                    if let Some(ok) = self.find_from(next.as_ref(), method, s, i, parameter_offsets) {
                        return Some(ok);
                    } else {
                        parameter_offsets.truncate(checkpoint);
                    }
                }
            }

            if wildcard_route_key != 0 {
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
                    let out_parameter_offsets = parameter_offsets.clone().into_vec();

                    return Some(super::super::RouteMatchResult {
                        route_key: Self::decode_route_key(wildcard_route_key),
                        parameter_offsets: out_parameter_offsets,
                    });
                } else {
                    let checkpoint = parameter_offsets.len();

                    parameter_offsets.push(("*".to_string(), (cap_start, rest_len)));

                    let out = Some(super::super::RouteMatchResult {
                        route_key: Self::decode_route_key(wildcard_route_key),
                        parameter_offsets: parameter_offsets.clone().into_vec(),
                    });

                    parameter_offsets.truncate(checkpoint);

                    return out;
                }
            }

            #[cold]
            fn miss2() -> Option<super::super::RouteMatchResult> {
                None
            }

            return miss2();
        }
    }

    #[inline]
    pub fn find_route(&self, method: HttpMethod, path: &str) -> Option<super::super::RouteMatchResult> {
        if !path.is_ascii() {
            return None;
        }

        if path == "/" {
            let method_idx = method as usize;
            let route_key = self.root_node.routes[method_idx];

            if route_key != 0 {
                return Some(super::super::RouteMatchResult {
                    route_key: Self::decode_route_key(route_key),
                    parameter_offsets: vec![],
                });
            }

            return None;
        }

        let norm = super::super::normalize_path(path);

        self.find_normalized_route(method, norm.as_str())
    }

    #[inline(always)]
    pub fn find_normalized_route(
        &self,
        method: HttpMethod,
        normalized_path: &str,
    ) -> Option<super::super::RouteMatchResult> {
        if !normalized_path.is_ascii() {
            return None;
        }

        let method_idx = method as usize;

        if normalized_path.as_bytes().iter().all(|&b| b == b'/') {
            let route_key = self.root_node.routes[method_idx];
            if route_key != 0 {
                return Some(super::super::RouteMatchResult {
                    route_key: Self::decode_route_key(route_key),
                    parameter_offsets: vec![],
                });
            }
            return None;
        }

        if self.root_node.is_sealed() && self.enable_static_route_full_mapping {
            if let Some(&rk) = self.static_route_full_mapping[method_idx].get(normalized_path)
             {
                return Some(super::super::RouteMatchResult {
                    route_key: Self::decode_route_key(rk),
                    parameter_offsets: vec![],
                });
            }
        }

        if self.root_node.is_sealed() && self.enable_root_level_pruning {
            if !self.root_parameter_first_present[method_idx] && !self.root_wildcard_present[method_idx]
            {
                let bs = normalized_path.as_bytes();
                let mut i = 0usize;

                while i < bs.len() && bs[i] == b'/' {
                    i += 1;
                }

                if i < bs.len() {
                    let hb = bs[i];

                    let blk = (hb as usize) >> 6;
                    let bit = 1u64 << ((hb as usize) & 63);
                    let head_present_any = self.method_first_byte_bitmaps[method_idx][0]
                        | self.method_first_byte_bitmaps[method_idx][1]
                        | self.method_first_byte_bitmaps[method_idx][2]
                        | self.method_first_byte_bitmaps[method_idx][3];

                    if head_present_any != 0 && (self.method_first_byte_bitmaps[method_idx][blk] & bit) == 0
                    {
                        return None;
                    }

                    let mut j = i;

                    while j < bs.len() && bs[j] != b'/' {
                        j += 1;
                    }

                    let seg_len = (j - i).min(63) as u32;
                    let lbit = 1u64 << seg_len;

                    if self.method_length_buckets[method_idx] != 0
                        && (self.method_length_buckets[method_idx] & lbit) == 0
                    {
                        return None;
                    }
                }
            }
        }

        if normalized_path == "/" {
            let route_key = self.root_node.routes[method_idx];

            if route_key != 0 {
                return Some(super::super::RouteMatchResult {
                    route_key: Self::decode_route_key(route_key),
                    parameter_offsets: vec![],
                });
            }

            return None;
        }

        let mut parameter_offsets: SmallVec<[(String, (usize, usize)); 8]> = SmallVec::new();

        let res = self.find_from(&self.root_node, method, normalized_path, 0, &mut parameter_offsets);

        res
    }
}