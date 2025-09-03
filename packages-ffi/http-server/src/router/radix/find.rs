use crate::router::pattern;

use super::{RadixRouter, method_index};

#[inline]
fn starts_with_ascii_ci(hay: &str, pre: &str) -> bool {
    if pre.len() > hay.len() {
        return false;
    }
    hay.as_bytes()
        .iter()
        .zip(pre.as_bytes().iter())
        .take(pre.len())
        .all(|(a, b)| a.eq_ignore_ascii_case(b))
}

impl RadixRouter {
    fn find_from(
        &self,
        mut node: &super::node::RadixNode,
        method: super::super::Method,
        s: &str,
        mut i: usize,
        params: Vec<(String, (usize, usize))>,
    ) -> Option<super::super::MatchResult> {
        let bytes = s.as_bytes();
        while i < bytes.len() && bytes[i] == b'/' {
            i += 1;
        }
        loop {
            if let Some(edge) = node.fused_edge.as_ref() {
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
                    if let Some(child) = node.fused_child.as_ref() {
                        node = child.as_ref();
                        i = ni;
                        continue;
                    }
                }
            }

            let wildcard_key = node.wildcard_routes[method_index(method)];
            if i >= s.len() {
                let rk = node.routes[method_index(method)];
                if rk != 0 {
                    return Some(super::super::MatchResult { key: rk, params });
                }
                if wildcard_key != 0 {
                    return Some(super::super::MatchResult {
                        key: wildcard_key,
                        params,
                    });
                }
                return None;
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

            let mut cand_idxs: Vec<usize> = Vec::new();
            if !node.pattern_children.is_empty() {
                let first = node.pattern_candidates_for(comp);
                if !first.is_empty() {
                    cand_idxs.extend(first);
                } else {
                    for idx in 0..node.pattern_children.len() {
                        cand_idxs.push(idx);
                    }
                }
            }

            if let Some(next) = node.get_static_ref(comp)
                && let Some(ok) = self.find_from(next, method, s, i, params.clone())
            {
                return Some(ok);
            }

            for idx in cand_idxs {
                let (pat, next) = &node.pattern_children[idx];
                if let Some(kvs) = pattern::match_segment(seg, comp, pat) {
                    let mut new_params = params.clone();
                    for (name, (off, len)) in kvs.into_iter() {
                        new_params.push((name, (start + off, len)));
                    }
                    if let Some(ok) = self.find_from(next.as_ref(), method, s, i, new_params) {
                        return Some(ok);
                    }
                }
            }

            if wildcard_key != 0 {
                let mut rest = &s[start..];
                if rest.starts_with('/') {
                    rest = &rest[1..];
                }
                let mut new_params = params;
                new_params.push(("*".to_string(), (start, rest.len())));
                return Some(super::super::MatchResult {
                    key: wildcard_key,
                    params: new_params,
                });
            }
            return None;
        }
    }

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
        self.find_from(&self.root, method, norm.as_str(), 0, Vec::new())
    }
}
