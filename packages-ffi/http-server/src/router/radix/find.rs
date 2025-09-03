//! Route lookup logic.

use crate::router::pattern::{SegmentPart, match_segment};

use super::{method_index, RadixRouter};

#[inline]
fn starts_with_ascii_ci(hay: &str, pre: &str) -> bool {
    if pre.len() > hay.len() { return false; }
    hay.as_bytes()
        .iter()
        .zip(pre.as_bytes().iter())
        .take(pre.len())
        .all(|(a, b)| a.to_ascii_lowercase() == b.to_ascii_lowercase())
}

impl RadixRouter {
    /// Find a route key and parameter offsets for a given method/path.
    ///
    /// Algorithm outline:
    /// - Normalize path according to options
    /// - Traverse fused static edges greedily (case-aware)
    /// - For each segment: try static child first; then pattern children
    ///   using first-literal index; finally wildcard route
    pub fn find(&self, method: super::super::Method, path: &str) -> Option<super::super::MatchResult> {
        let orig = super::super::normalize_path(path, &self.options);
        if orig.len() > self.options.max_path_length { return None; }
        let s = orig.as_str();
        let bytes = s.as_bytes();
        let mut params: Vec<(String, (usize, usize))> = Vec::new();
        let mut node = &self.root;
        let mut i = 0usize;

        // skip leading slashes
        while i < bytes.len() && bytes[i] == b'/' { i += 1; }

        loop {
            // prefix-compressed static edge
            if let Some(edge) = node.fused_edge.as_ref() {
                let rem = &s[i..];
                let ok = if self.options.case_sensitive {
                    rem.as_bytes().starts_with(edge.as_bytes())
                } else {
                    starts_with_ascii_ci(rem, edge.as_str())
                };
                if ok {
                    let mut ni = i + edge.len();
                    while ni < s.len() && s.as_bytes()[ni] == b'/' { ni += 1; }
                    if let Some(child) = node.fused_child.as_ref() {
                        node = child.as_ref();
                        i = ni;
                        continue;
                    }
                }
            }

            // wildcard candidate at current node
            let wildcard_key = node.wildcard_routes[method_index(method)];

            if i >= bytes.len() {
                // terminal
                let rk = node.routes[method_index(method)];
                if rk != 0 { return Some(super::super::MatchResult { key: rk, params }); }
                if wildcard_key != 0 { return Some(super::super::MatchResult { key: wildcard_key, params }); }
                return None;
            }

            // find next segment end
            let start = i;
            while i < bytes.len() && bytes[i] != b'/' { i += 1; }
            let seg = &s[start..i];
            let key_lookup_owned;
            let key_lookup: &str = if self.options.case_sensitive { seg } else { key_lookup_owned = seg.to_ascii_lowercase(); &key_lookup_owned };

            // static match first
            if let Some(next) = node.get_static_ref(key_lookup) {
                node = next;
            } else if !node.pattern_children.is_empty() {
                let mut matched = false;
                let comp = key_lookup;
                // use first-literal index if available
                let cands = node.pattern_candidates_for(comp);
                if !cands.is_empty() {
                    for &idx in cands.iter() {
                        let (pat, next) = &node.pattern_children[idx];
                        if let Some(kvs) = match_segment(seg, comp, pat, self.options.max_param_length) {
                            for (name, (off, len)) in kvs.into_iter() {
                                params.push((name, (start + off, len)));
                                if params.len() > self.options.max_total_params { return None; }
                            }
                            node = next.as_ref();
                            matched = true;
                            break;
                        }
                    }
                } else {
                    for (pat, next) in node.pattern_children.iter() {
                        if let Some(SegmentPart::Literal(l0)) = pat.parts.first() {
                            if comp.len() < l0.len() || &comp[..l0.len()] != l0 { continue; }
                        }
                        if let Some(kvs) = match_segment(seg, comp, pat, self.options.max_param_length) {
                            for (name, (off, len)) in kvs.into_iter() {
                                params.push((name, (start + off, len)));
                                if params.len() > self.options.max_total_params { return None; }
                            }
                            node = next.as_ref();
                            matched = true;
                            break;
                        }
                    }
                }
                if !matched {
                    if wildcard_key != 0 {
                        let mut rest = &s[start..];
                        if rest.starts_with('/') { rest = &rest[1..]; }
                        if rest.len() > self.options.max_param_length { return None; }
                        params.push(("*".to_string(), (start + 1, rest.len())));
                        return Some(super::super::MatchResult { key: wildcard_key, params });
                    }
                    return None;
                }
            } else {
                // no match at this level; try wildcard
                if wildcard_key != 0 {
                    let mut rest = &s[start..];
                    if rest.starts_with('/') { rest = &rest[1..]; }
                    if rest.len() > self.options.max_param_length { return None; }
                    params.push(("*".to_string(), (start + 1, rest.len())));
                    return Some(super::super::MatchResult { key: wildcard_key, params });
                }
                return None;
            }

            // skip consecutive slashes
            while i < bytes.len() && bytes[i] == b'/' { i += 1; }
        }
    }
}


