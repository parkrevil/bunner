use crate::router::pattern;
use smallvec::SmallVec;

use super::{node::RadixTreeNode, RadixTree};
use crate::r#enum::HttpMethod;

const INITIAL_PARAMETER_OFFSETS_CAPACITY: usize = 8;

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

fn handle_end_of_path(
    node: &RadixTreeNode,
    method: HttpMethod,
    parameter_offsets: &mut SmallVec<
        [(String, (usize, usize)); INITIAL_PARAMETER_OFFSETS_CAPACITY],
    >,
) -> Option<super::super::RouteMatchResult> {
    let method_idx = method as usize;
    let rk = node.routes[method_idx];

    if rk != 0 {
        return Some(super::super::RouteMatchResult {
            route_key: RadixTree::decode_route_key(rk),
            parameter_offsets: parameter_offsets.clone().into_vec(),
        });
    }

    let wildcard_route_key = node.wildcard_routes[method_idx];
    if wildcard_route_key != 0 {
        return Some(super::super::RouteMatchResult {
            route_key: RadixTree::decode_route_key(wildcard_route_key),
            parameter_offsets: parameter_offsets.clone().into_vec(),
        });
    }

    None
}

fn find_pattern_child<'a>(
    tree: &'a RadixTree,
    node: &'a RadixTreeNode,
    method: HttpMethod,
    path: &str,
    segment: &str,
    segment_offset: usize,
    parameter_offsets: &mut SmallVec<
        [(String, (usize, usize)); INITIAL_PARAMETER_OFFSETS_CAPACITY],
    >,
) -> Option<super::super::RouteMatchResult> {
    let mut cand_idxs: SmallVec<[u16; 8]> = node.pattern_candidates_for(segment);

    if cand_idxs.is_empty() {
        cand_idxs.extend((0..node.patterns.len()).map(|i| i as u16));
    }

    if cand_idxs.len() > 1 {
        let mut scores_with_idx: SmallVec<[(u16, u16); 64]> =
            SmallVec::with_capacity(cand_idxs.len());
        for &i0 in cand_idxs.iter() {
            let score = node
                .pattern_meta
                .get(i0 as usize)
                .map(|meta| meta.score)
                .unwrap_or(0);
            scores_with_idx.push((score, i0));
        }
        scores_with_idx.sort_unstable_by_key(|&(s, _)| core::cmp::Reverse(s));
        cand_idxs.clear();
        for &(_, idx0) in scores_with_idx.iter() {
            cand_idxs.push(idx0);
        }
    }

    for idx_u16 in cand_idxs {
        let idx = idx_u16 as usize;
        let pat = &node.patterns[idx];
        let child_nb = &node.pattern_nodes[idx];

        prefetch_node(child_nb.as_ref());

        if let Some(kvs) = pattern::match_segment(segment, segment, pat) {
            let checkpoint = parameter_offsets.len();
            for (name, (off, len)) in kvs.into_iter() {
                parameter_offsets.push((name, (segment_offset + off, len)));
            }

            let path_offset = segment_offset + segment.len();
            if let Some(ok) = tree.find_from(
                child_nb.as_ref(),
                method,
                path,
                path_offset,
                parameter_offsets,
            ) {
                return Some(ok);
            } else {
                parameter_offsets.truncate(checkpoint);
            }
        }
    }

    None
}

fn handle_wildcard(
    node: &RadixTreeNode,
    method: HttpMethod,
    path: &str,
    segment_offset: usize,
    parameter_offsets: &mut SmallVec<
        [(String, (usize, usize)); INITIAL_PARAMETER_OFFSETS_CAPACITY],
    >,
) -> Option<super::super::RouteMatchResult> {
    let wildcard_route_key = node.wildcard_routes[method as usize];
    if wildcard_route_key == 0 {
        return None;
    }

    let mut cap_start = segment_offset;
    if cap_start < path.len() && path.as_bytes()[cap_start] == b'/' {
        cap_start += 1;
    }

    let rest_len = if cap_start <= path.len() {
        path.len() - cap_start
    } else {
        0
    };

    if rest_len > 0 {
        parameter_offsets.push(("*".to_string(), (cap_start, rest_len)));
    }

    Some(super::super::RouteMatchResult {
        route_key: RadixTree::decode_route_key(wildcard_route_key),
        parameter_offsets: parameter_offsets.clone().into_vec(),
    })
}

impl RadixTree {
    #[inline(always)]
    fn decode_route_key(stored: u16) -> u16 {
        if stored > 0 {
            stored - 1
        } else {
            0
        }
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
        i: usize,
        parameter_offsets: &mut SmallVec<
            [(String, (usize, usize)); INITIAL_PARAMETER_OFFSETS_CAPACITY],
        >,
    ) -> Option<super::super::RouteMatchResult> {
        let current_i = self.skip_slashes(s, i);

        if let Some(edge) = &node.fused_edge {
            let rem = &s[current_i..];
            if !rem.starts_with(edge.as_str()) {
                return None;
            }

            let next_i = current_i + edge.len();
            if let Some(child) = &node.fused_child {
                return self.find_from(child, method, s, next_i, parameter_offsets);
            }
            return None;
        }

        if current_i >= s.len() {
            return handle_end_of_path(node, method, parameter_offsets);
        }

        let start = current_i;
        let next_slash = s[start..].find('/').map_or(s.len(), |pos| start + pos);
        let seg = &s[start..next_slash];

        if let Some(next_node) = node.get_static_child(seg, self.interner.get(seg)) {
            prefetch_node(next_node);
            if let Some(result) =
                self.find_from(next_node, method, s, next_slash, parameter_offsets)
            {
                return Some(result);
            }
        }

        if let Some(result) =
            find_pattern_child(self, node, method, s, seg, start, parameter_offsets)
        {
            return Some(result);
        }

        let checkpoint = parameter_offsets.len();
        if let Some(result) = handle_wildcard(node, method, s, start, parameter_offsets) {
            return Some(result);
        }
        parameter_offsets.truncate(checkpoint);

        None
    }

    #[inline(always)]
    pub fn find_normalized(
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

        if self.root_node.is_sealed()
            && self.enable_static_route_full_mapping
            && let Some(&rk) = self.static_route_full_mapping[method_idx].get(normalized_path)
        {
            return Some(super::super::RouteMatchResult {
                route_key: Self::decode_route_key(rk),
                parameter_offsets: vec![],
            });
        }

        if self.root_node.is_sealed()
            && self.enable_root_level_pruning
            && !self.root_parameter_first_present[method_idx]
            && !self.root_wildcard_present[method_idx]
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

                if head_present_any != 0
                    && (self.method_first_byte_bitmaps[method_idx][blk] & bit) == 0
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

        let mut parameter_offsets: SmallVec<
            [(String, (usize, usize)); INITIAL_PARAMETER_OFFSETS_CAPACITY],
        > = SmallVec::new();

        self.find_from(
            &self.root_node,
            method,
            normalized_path,
            0,
            &mut parameter_offsets,
        )
    }
}
