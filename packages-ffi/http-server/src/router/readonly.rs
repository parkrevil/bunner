use super::errors::RouterErrorCode;
use super::path::is_path_character_allowed;
use super::path::normalize_path;
use super::structures::RouterError;
use super::{radix_tree::HTTP_METHOD_COUNT, Router};
use crate::enums::HttpMethod;
use crate::router::pattern::{self, SegmentPattern};
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct RouterReadOnly {
    static_maps: [HashMap<String, u16>; HTTP_METHOD_COUNT],
    root: ReadOnlyNode,
}

impl RouterReadOnly {
    /// Read-only router built for lock-free concurrent lookups.
    ///
    /// Safety & Concurrency:
    /// - Contains only immutable owned data structures
    /// - No interior mutability
    /// - Safe to share across threads (`Send + Sync` by construction)
    pub fn from_router(router: &Router) -> Self {
        let mut maps: [HashMap<String, u16>; HTTP_METHOD_COUNT] = Default::default();
        for (i, out_map) in maps.iter_mut().enumerate().take(HTTP_METHOD_COUNT) {
            let mut out: HashMap<String, u16> =
                HashMap::with_capacity(router.radix_tree.static_route_full_mapping[i].len());
            for (k, v) in router.radix_tree.static_route_full_mapping[i].iter() {
                out.insert(k.clone(), *v);
            }
            *out_map = out;
        }

        let root = ReadOnlyNode::from_node(&router.radix_tree.root_node);

        RouterReadOnly {
            static_maps: maps,
            root,
        }
    }

    #[inline]
    pub fn find_static(&self, method: HttpMethod, path: &str) -> Option<u16> {
        let normalized = normalize_path(path);
        let idx = method as usize;
        self.static_maps[idx].get(&normalized).cloned()
    }

    pub fn find(
        &self,
        method: HttpMethod,
        path: &str,
    ) -> Result<(u16, Vec<(String, String)>), RouterError> {
        if path.is_empty() {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathEmpty,
                "Empty path provided to router find()".to_string(),
                Some(crate::util::make_error_detail(
                    "find",
                    serde_json::json!({
                        "path": path,
                        "method": method as u8
                    }),
                )),
            ));
        }

        if !path.is_ascii() {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathNotAscii,
                "Path contains non-ASCII characters".to_string(),
                Some(crate::util::make_error_detail(
                    "find",
                    serde_json::json!({
                        "path": path,
                        "method": method as u8
                    }),
                )),
            ));
        }

        if !is_path_character_allowed(path) {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathContainsDisallowedCharacters,
                "Path contains disallowed characters".to_string(),
                Some(crate::util::make_error_detail(
                    "find",
                    serde_json::json!({
                        "path": path,
                        "method": method as u8
                    }),
                )),
            ));
        }

        let normalized = normalize_path(path);

        if !is_path_character_allowed(&normalized) {
            return Err(RouterError::new(
                RouterErrorCode::MatchPathContainsDisallowedCharacters,
                "Normalized path contains disallowed characters".to_string(),
                Some(crate::util::make_error_detail(
                    "find",
                    serde_json::json!({
                        "path": normalized,
                        "method": method as u8
                    }),
                )),
            ));
        }

        if let Some(k) = self.find_static(method, &normalized) {
            return Ok((k, Vec::new()));
        }

        let mut out_params: Vec<(String, String)> = Vec::new();
        if let Some((rk, params)) = self.root.find_from(method, &normalized, 0, &mut out_params) {
            Ok((rk, params))
        } else {
            Err(RouterError::new(
                RouterErrorCode::MatchNotFound,
                "No route matched for given method and path".to_string(),
                Some(crate::util::make_error_detail(
                    "find",
                    serde_json::json!({
                        "path": normalized,
                        "method": method as u8
                    }),
                )),
            ))
        }
    }
}

// Compile-time assertion: RouterReadOnly and ReadOnlyNode must be Send + Sync
#[allow(dead_code)]
const _: fn() = || {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<RouterReadOnly>();
    assert_send_sync::<ReadOnlyNode>();
};

#[derive(Debug, Clone, Default)]
struct ReadOnlyNode {
    fused_edge: Option<String>,
    routes: [u16; HTTP_METHOD_COUNT],
    wildcard_routes: [u16; HTTP_METHOD_COUNT],
    static_children: HashMap<String, ReadOnlyNode>,
    patterns: Vec<(SegmentPattern, ReadOnlyNode)>,
}

impl ReadOnlyNode {
    fn from_node(n: &super::radix_tree::node::RadixTreeNode) -> Self {
        // Build static_children from any of the available indexed views
        let mut static_children: HashMap<String, ReadOnlyNode> = HashMap::new();
        if !n.static_keys.is_empty() && n.static_vals_idx.len() == n.static_keys.len() {
            for (i, key) in n.static_keys.iter().enumerate() {
                let child = n.static_vals_idx[i].as_ref();
                static_children.insert(key.clone(), ReadOnlyNode::from_node(child));
            }
        } else if !n.static_children_idx.is_empty() {
            for (k, v) in n.static_children_idx.iter() {
                static_children.insert(k.clone(), ReadOnlyNode::from_node(v.as_ref()));
            }
        } else {
            for (k, v) in n.static_children.iter() {
                static_children.insert(k.clone(), ReadOnlyNode::from_node(v.as_ref()));
            }
            for (i, key) in n.static_keys.iter().enumerate() {
                static_children.insert(
                    key.clone(),
                    ReadOnlyNode::from_node(n.static_vals[i].as_ref()),
                );
            }
        }

        // Patterns
        let mut patterns: Vec<(SegmentPattern, ReadOnlyNode)> =
            Vec::with_capacity(n.patterns.len());
        for (i, pat) in n.patterns.iter().enumerate() {
            let child = n.pattern_nodes[i].as_ref();
            patterns.push((pat.clone(), ReadOnlyNode::from_node(child)));
        }

        // Fused child
        let mut ro = ReadOnlyNode {
            fused_edge: n.fused_edge.clone(),
            routes: n.routes,
            wildcard_routes: n.wildcard_routes,
            static_children,
            patterns,
        };

        if let Some(fc) = n.fused_child.as_ref() {
            let fc_node = ReadOnlyNode::from_node(fc.as_ref());
            // Represent fused child as a single static child with empty key when fused_edge is set
            // so that traversal handles it uniformly.
            ro.static_children.insert(String::new(), fc_node);
        }

        ro
    }

    fn skip_slashes(s: &str, mut i: usize) -> usize {
        let bs = s.as_bytes();
        if i < bs.len() && bs[i] == b'/' {
            i += 1;
        }
        i
    }

    fn handle_end(
        &self,
        method: HttpMethod,
        params: &mut [(String, String)],
    ) -> Option<(u16, Vec<(String, String)>)> {
        let idx = method as usize;
        let rk = self.routes[idx];
        if rk != 0 {
            return Some((rk - 1, params.to_owned()));
        }
        let wrk = self.wildcard_routes[idx];
        if wrk != 0 {
            return Some((wrk - 1, params.to_owned()));
        }
        None
    }

    fn find_from(
        &self,
        method: HttpMethod,
        s: &str,
        i: usize,
        params: &mut Vec<(String, String)>,
    ) -> Option<(u16, Vec<(String, String)>)> {
        let current_i = Self::skip_slashes(s, i);

        if let Some(edge) = &self.fused_edge {
            let rem = &s[current_i..];
            if !rem.starts_with(edge.as_str()) {
                return None;
            }
            // descend to fused child stored under empty key
            if let Some(child) = self.static_children.get("") {
                return child.find_from(method, s, current_i + edge.len(), params);
            }
            return None;
        }

        if current_i >= s.len() {
            return self.handle_end(method, params);
        }

        let start = current_i;
        let next_slash = s[start..].find('/').map_or(s.len(), |pos| start + pos);
        let seg = &s[start..next_slash];

        if let Some(next_node) = self.static_children.get(seg)
            && let Some(ok) = next_node.find_from(method, s, next_slash, params)
        {
            return Some(ok);
        }

        // Pattern children
        for (pat, child) in self.patterns.iter() {
            if let Some(kvs) = pattern::match_segment(seg, seg, pat) {
                let checkpoint = params.len();
                for (name, (off, len)) in kvs.into_iter() {
                    let abs = start + off;
                    if abs + len <= s.len() {
                        params.push((name, s[abs..abs + len].to_string()));
                    }
                }
                if let Some(ok) = child.find_from(method, s, next_slash, params) {
                    return Some(ok);
                }
                params.truncate(checkpoint);
            }
        }

        // Wildcard
        let wrk = self.wildcard_routes[method as usize];
        if wrk != 0 {
            let mut cap_start = start;
            if cap_start < s.len() && s.as_bytes()[cap_start] == b'/' {
                cap_start += 1;
            }
            if cap_start <= s.len() {
                let rest = &s[cap_start..];
                if !rest.is_empty() {
                    params.push(("*".to_string(), rest.to_string()));
                }
            }
            return Some((wrk - 1, params.clone()));
        }

        None
    }
}
