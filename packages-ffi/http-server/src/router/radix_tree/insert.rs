use crate::router::errors::RouterError;
use crate::router::pattern::{
    SegmentPart, SegmentPattern, pattern_compatible_policy, pattern_is_pure_static, pattern_score,
};
use crate::r#enum::HttpMethod;
use hashbrown::HashSet;
use std::sync::atomic::AtomicU16;
use super::{RadixTree, RadixTreeNode, create_node_box_from_arena_pointer, node::PatternMeta, MAX_ROUTES};
use crate::router::interner::Interner;

impl RadixTree {
    pub fn insert(&mut self, method: HttpMethod, path: &str) -> Result<u16, RouterError> {
        if self.root_node.is_sealed() {
            return Err(RouterError::RouterSealedCannotInsert);
        }
        self.root_node.set_dirty(true);

        if path == "/" {
            return assign_route_key(&mut self.root_node, method, &self.next_route_key);
        }

        let parsed_segments = self.prepare_path_segments(path)?;
        self.insert_parsed(method, parsed_segments)
    }

    pub(super) fn insert_parsed(
        &mut self,
        method: HttpMethod,
        parsed_segments: Vec<SegmentPattern>,
    ) -> Result<u16, RouterError> {
        if self.root_node.is_sealed() {
            return Err(RouterError::RouterSealedCannotInsert);
        }
        self.root_node.set_dirty(true);

        let mut current = &mut self.root_node;
        let arena_ptr: *const bumpalo::Bump = &self.arena;

        for (i, pat) in parsed_segments.iter().enumerate() {
            let seg = pat.parts.iter().map(|p| match p {
                SegmentPart::Literal(s) => s.clone(),
                SegmentPart::Param { name } => format!(":{}", name),
            }).collect::<Vec<String>>().join("");

            if seg == "*" {
                return handle_wildcard_insert(current, method, i, parsed_segments.len(), &self.next_route_key);
            }

            if pattern_is_pure_static(pat, &seg) {
                current = current.descend_static_mut_with_alloc(seg.to_string(), || {
                    create_node_box_from_arena_pointer(arena_ptr)
                });
                sort_static_children(current, &self.interner);
            } else {
                current = find_or_create_pattern_child(current, pat, arena_ptr)?;
            }
            
            let current_mask = current.method_mask();
            current.set_method_mask(current_mask | (1 << (method as usize)));
            current.set_dirty(true);
        }

        assign_route_key(current, method, &self.next_route_key)
    }

    pub(super) fn prepare_path_segments(&self, path: &str) -> Result<Vec<SegmentPattern>, RouterError> {
        prepare_path_segments_standalone(path)
    }
}

fn sort_static_children(node: &mut RadixTreeNode, interner: &Interner) {
    if node.static_keys.len() == node.static_vals.len() && node.static_keys.len() > 1 {
        let mut pairs: Vec<(u32, String, super::NodeBox)> = node
            .static_keys
            .iter()
            .cloned()
            .zip(node.static_vals.iter().map(|nb| super::NodeBox(nb.0)))
            .map(|(k, v)| (interner.intern(k.as_str()), k, v))
            .collect();
        pairs.sort_unstable_by(|a, b| a.0.cmp(&b.0));
        node.static_keys.clear();
        node.static_vals.clear();
        for (_id, k, v) in pairs.into_iter() {
            node.static_keys.push(k);
            node.static_vals.push(v);
        }
    }
}

fn find_or_create_pattern_child<'a>(
    node: &'a mut RadixTreeNode,
    pat: &SegmentPattern,
    arena_ptr: *const bumpalo::Bump,
) -> Result<&'a mut RadixTreeNode, RouterError> {
    for exist in node.patterns.iter() {
        if !pattern_compatible_policy(exist, pat) {
            return Err(RouterError::RouteParamNameConflictAtSamePosition);
        }
    }

    if let Some(existing_idx) = node.patterns.iter().position(|exist| exist == pat) {
        return Ok(node.pattern_nodes.get_mut(existing_idx).unwrap().as_mut());
    }

    let score = pattern_score(pat);
    let insert_pos = node.pattern_meta.iter().position(|&meta| meta.score < score).unwrap_or(node.patterns.len());
    
    node.patterns.insert(insert_pos, pat.clone());
    node.pattern_nodes.insert(insert_pos, create_node_box_from_arena_pointer(arena_ptr));

    Ok(node.pattern_nodes.get_mut(insert_pos).unwrap().as_mut())
}

fn handle_wildcard_insert(node: &mut RadixTreeNode, method: HttpMethod, index: usize, total_segments: usize, next_route_key: &AtomicU16) -> Result<u16, RouterError> {
    if index != total_segments - 1 {
        return Err(RouterError::RouteWildcardSegmentNotAtEnd);
    }
    let method_idx = method as usize;
    if node.wildcard_routes[method_idx] != 0 {
        return Err(RouterError::RouteWildcardAlreadyExistsForMethod);
    }
    let key = next_route_key.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    node.wildcard_routes[method_idx] = key + 1;
    
    let current_mask = node.method_mask();
    node.set_method_mask(current_mask | (1 << method_idx));
    node.set_dirty(true);

    Ok(key)
}

fn assign_route_key(node: &mut RadixTreeNode, method: HttpMethod, next_route_key: &AtomicU16) -> Result<u16, RouterError> {
    let method_idx = method as usize;
    if node.routes[method_idx] != 0 {
        return Err(RouterError::RouteConflictOnDuplicatePath);
    }
    let current_key = next_route_key.load(std::sync::atomic::Ordering::Relaxed);
    if current_key >= MAX_ROUTES {
        return Err(RouterError::MaxRoutesExceeded);
    }
    let key = next_route_key.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    node.routes[method_idx] = key + 1;
    
    let current_mask = node.method_mask();
    node.set_method_mask(current_mask | (1 << method_idx));
    node.set_dirty(true);

    Ok(key)
}

// Helper for SegmentPart
impl SegmentPart {
    fn is_literal(&self) -> bool {
        matches!(self, SegmentPart::Literal(_))
    }
}

// Thread-safe standalone parser for bulk preprocess
pub(super) fn prepare_path_segments_standalone(path: &str) -> Result<Vec<SegmentPattern>, RouterError> {
    if path.is_empty() { return Err(RouterError::RoutePathEmpty); }
    if !path.is_ascii() { return Err(RouterError::RoutePathNotAscii); }

    let norm = crate::router::path::normalize_path(path);
    if !crate::router::path::is_path_character_allowed(&norm) {
        return Err(RouterError::RoutePathContainsDisallowedCharacters);
    }

    if norm == "/" { return Ok(Vec::new()); }

    let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() { return Err(RouterError::RoutePathSyntaxInvalid); }

    let mut parsed_segments = Vec::with_capacity(segments.len());
    let mut seen_params = HashSet::new();

    for seg in segments {
        let pat = crate::router::pattern::parse_segment(seg)?;

        let mut min_len = 0u16;
        let mut last_lit_len = 0u16;
        for part in pat.parts.iter() {
            if let SegmentPart::Literal(l) = part {
                min_len += l.len() as u16;
            }
        }
        if let Some(SegmentPart::Literal(l)) = pat.parts.iter().rev().find(|p| p.is_literal()) {
            last_lit_len = l.len() as u16;
        }

        if !PatternMeta::is_valid_length(min_len, last_lit_len) {
            return Err(RouterError::PatternTooLong);
        }

        for part in &pat.parts {
            if let SegmentPart::Param { name, .. } = part {
                if seen_params.contains(name.as_str()) {
                    return Err(RouterError::RouteDuplicateParamNameInRoute);
                }
                seen_params.insert(name.clone());
            }
        }
        parsed_segments.push(pat);
    }
    Ok(parsed_segments)
}
