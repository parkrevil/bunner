use crate::router::pattern;
use smallvec::SmallVec;

use super::{RadixRouter, method_index};

#[inline(always)]
fn starts_with_ascii_ci(hay: &str, pre: &str) -> bool {
    let hb = hay.as_bytes();
    let pb = pre.as_bytes();
    let n = pb.len();
    if n > hb.len() {
        return false;
    }
    let mut i = 0usize;
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
    fn find_from(
        &self,
        node: &super::node::RadixNode,
        method: super::super::Method,
        s: &str,
        mut i: usize,
        params: &mut SmallVec<[(String, (usize, usize)); 8]>,
    ) -> Option<super::super::MatchResult> {
        let bytes = s.as_bytes();
        let mut cur = node;
        while i < bytes.len() && bytes[i] == b'/' {
            i += 1;
        }
        loop {
            if let Some(edge) = cur.fused_edge.as_ref() {
                let rem = &s[i..];
                let ok = if self.options.case_sensitive {
                    rem.as_bytes().starts_with(edge.as_bytes())
                } else {
                    starts_with_ascii_ci(rem, edge.as_str())
                };
                if ok {
                    let mut ni = i + edge.len();
                    while ni < s.len() && s.as_bytes()[ni] == b'/' {
                        ni += 1;
                    }
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
                }
            }

            let m_idx = method_index(method);
            let wildcard_key = cur.wildcard_routes[m_idx];
            if i >= s.len() {
                let rk = cur.routes[m_idx];
                if rk != 0 {
                    return Some(super::super::MatchResult {
                        key: rk,
                        params: params.clone().into_vec(),
                    });
                }
                if wildcard_key != 0 {
                    return Some(super::super::MatchResult {
                        key: wildcard_key,
                        params: params.clone().into_vec(),
                    });
                }
                #[cold]
                fn miss() -> Option<super::super::MatchResult> {
                    None
                }
                return miss();
            }

            let start = i;
            while i < s.len() && s.as_bytes()[i] != b'/' {
                i += 1;
            }
            let seg = &s[start..i];
            let key_lookup_owned;
            let comp: &str = if self.options.case_sensitive {
                seg
            } else {
                key_lookup_owned = seg.to_ascii_lowercase();
                &key_lookup_owned
            };

            let mut cand_idxs: SmallVec<[usize; 8]> = SmallVec::new();
            if !cur.patterns.is_empty() {
                let first = cur.pattern_candidates_for(comp);
                if !first.is_empty() {
                    cand_idxs.extend(first);
                } else {
                    for idx in 0..cur.patterns.len() {
                        cand_idxs.push(idx);
                    }
                }
            }

            if let Some(key_id) = self.interner.get(comp)
                && let Some(nb) = cur.get_static_id_fast(key_id)
                && let Some(ok) = self.find_from(nb, method, s, i, params)
            {
                return Some(ok);
            }

            if let Some(nb) = cur.get_static_fast(comp)
                && let Some(ok) = self.find_from(nb, method, s, i, params)
            {
                return Some(ok);
            }
            if let Some(next) = cur.get_static_ref(comp)
                && let Some(ok) = self.find_from(next, method, s, i, params)
            {
                return Some(ok);
            }

            for idx in cand_idxs {
                if idx < cur.pattern_children_idx.len() {
                    let pat = &cur.patterns[idx];
                    let child_nb = &cur.pattern_nodes[idx];
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
                let mut rest = &s[start..];
                if rest.starts_with('/') {
                    rest = &rest[1..];
                }
                let checkpoint = params.len();
                params.push(("*".to_string(), (start, rest.len())));
                let out = Some(super::super::MatchResult {
                    key: wildcard_key,
                    params: params.clone().into_vec(),
                });
                params.truncate(checkpoint);
                return out;
            }
            #[cold]
            fn miss2() -> Option<super::super::MatchResult> {
                None
            }
            return miss2();
        }
    }

    #[inline]
    pub fn find(
        &self,
        method: super::super::Method,
        path: &str,
    ) -> Option<super::super::MatchResult> {
        if path == "/" {
            let idx = method_index(method);
            let key = self.root.routes[idx];
            if key != 0 {
                return Some(super::super::MatchResult {
                    key,
                    params: vec![],
                });
            }
            return None;
        }

        let norm = super::super::normalize_path(path, &self.options);
        self.find_norm(method, norm.as_str())
    }

    #[inline(always)]
    pub fn find_norm(
        &self,
        method: super::super::Method,
        norm_path: &str,
    ) -> Option<super::super::MatchResult> {
        if norm_path == "/" {
            let idx = method_index(method);
            let key = self.root.routes[idx];
            if key != 0 {
                return Some(super::super::MatchResult {
                    key,
                    params: vec![],
                });
            }
            return None;
        }
        let mut params: SmallVec<[(String, (usize, usize)); 8]> = SmallVec::new();
        self.find_from(&self.root, method, norm_path, 0, &mut params)
    }
}
