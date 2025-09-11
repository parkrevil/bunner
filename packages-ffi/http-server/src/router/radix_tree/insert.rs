use super::{
    create_node_box_from_arena_pointer, node::PatternMeta, RadixTree, RadixTreeNode, MAX_ROUTES,
};
use crate::r#enum::HttpMethod;
use crate::router::errors::RouterErrorCode;
use crate::router::interner::Interner;
use crate::router::pattern::{
    pattern_compatible_policy, pattern_is_pure_static, pattern_score, SegmentPart, SegmentPattern,
};
use crate::router::structures::RouterError;
use hashbrown::HashSet;
use serde_json::json;
use std::sync::atomic::AtomicU16;

impl RadixTree {
    pub fn insert(&mut self, method: HttpMethod, path: &str) -> Result<u16, RouterError> {
        if self.root_node.is_sealed() {
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                format!("Router is sealed; cannot insert path: '{}'", path),
                Some(json!({"operation":"insert","path": path})),
            ));
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
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                "Router is sealed; cannot insert parsed segments".to_string(),
                Some(json!({"operation":"insert_parsed"})),
            ));
        }
        self.root_node.set_dirty(true);

        let mut current = &mut self.root_node;
        let arena_ptr: *const bumpalo::Bump = &self.arena;

        for (i, pat) in parsed_segments.iter().enumerate() {
            let seg = pat
                .parts
                .iter()
                .map(|p| match p {
                    SegmentPart::Literal(s) => s.clone(),
                    SegmentPart::Param { name } => format!(":{}", name),
                })
                .collect::<Vec<String>>()
                .join("");

            if seg == "*" {
                return handle_wildcard_insert(
                    current,
                    method,
                    i,
                    parsed_segments.len(),
                    &self.next_route_key,
                );
            }

            if pattern_is_pure_static(pat, &seg) {
                current = current.descend_static_mut_with_alloc(seg.to_string(), || {
                    create_node_box_from_arena_pointer(arena_ptr)
                });
                sort_static_children(current, &self.interner);
            } else {
                current = find_or_create_pattern_child(current, pat, arena_ptr)?;
            }

            // method mask is delayed to finalize()
            current.set_dirty(true);
        }

        assign_route_key(current, method, &self.next_route_key)
    }

    pub(super) fn insert_parsed_preassigned(
        &mut self,
        method: HttpMethod,
        parsed_segments: Vec<SegmentPattern>,
        assigned_key: u16,
    ) -> Result<u16, RouterError> {
        if self.root_node.is_sealed() {
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                format!(
                    "Router is sealed; cannot insert parsed segments preassigned key={}",
                    assigned_key
                ),
                Some(json!({"operation":"insert_parsed_preassigned","assigned_key": assigned_key})),
            ));
        }
        self.root_node.set_dirty(true);

        let mut current = &mut self.root_node;
        let arena_ptr: *const bumpalo::Bump = &self.arena;

        for (i, pat) in parsed_segments.iter().enumerate() {
            let seg = pat
                .parts
                .iter()
                .map(|p| match p {
                    SegmentPart::Literal(s) => s.clone(),
                    SegmentPart::Param { name } => format!(":{}", name),
                })
                .collect::<Vec<String>>()
                .join("");

            if seg == "*" {
                return handle_wildcard_insert_preassigned(
                    current,
                    method,
                    i,
                    parsed_segments.len(),
                    assigned_key,
                );
            }

            if pattern_is_pure_static(pat, &seg) {
                current = current.descend_static_mut_with_alloc(seg.to_string(), || {
                    create_node_box_from_arena_pointer(arena_ptr)
                });
                sort_static_children(current, &self.interner);
            } else {
                current = find_or_create_pattern_child(current, pat, arena_ptr)?;
            }
            // Do not set method_mask here; delayed to finalize for bulk path
            current.set_dirty(true);
        }

        assign_route_key_preassigned(current, method, assigned_key)
    }

    pub(super) fn prepare_path_segments(
        &self,
        path: &str,
    ) -> Result<Vec<SegmentPattern>, RouterError> {
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
            return Err(RouterError::new(
                RouterErrorCode::RouteParamNameConflictAtSamePosition,
                "Parameter name conflict at the same position between patterns".to_string(),
                Some(json!({"operation":"find_or_create_pattern_child"})),
            ));
        }
    }

    if let Some(existing_idx) = node.patterns.iter().position(|exist| exist == pat) {
        return Ok(node.pattern_nodes.get_mut(existing_idx).unwrap().as_mut());
    }

    let score = pattern_score(pat);
    let insert_pos = node
        .pattern_meta
        .iter()
        .position(|&meta| meta.score < score)
        .unwrap_or(node.patterns.len());

    node.patterns.insert(insert_pos, pat.clone());
    node.pattern_nodes
        .insert(insert_pos, create_node_box_from_arena_pointer(arena_ptr));

    Ok(node.pattern_nodes.get_mut(insert_pos).unwrap().as_mut())
}

fn handle_wildcard_insert(
    node: &mut RadixTreeNode,
    method: HttpMethod,
    index: usize,
    total_segments: usize,
    next_route_key: &AtomicU16,
) -> Result<u16, RouterError> {
    if index != total_segments - 1 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardSegmentNotAtEnd,
            format!(
                "Wildcard segment '*' must be the final segment; found at index {} of {}",
                index, total_segments
            ),
            Some(
                json!({"operation":"handle_wildcard_insert","index": index, "total_segments": total_segments}),
            ),
        ));
    }
    let method_idx = method as usize;
    if node.wildcard_routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardAlreadyExistsForMethod,
            "Wildcard route already exists for this method at the node".to_string(),
            Some(json!({"operation":"handle_wildcard_insert","method":method as u8})),
        ));
    }
    let key = next_route_key.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    node.wildcard_routes[method_idx] = key + 1;

    // method mask is delayed to finalize()
    node.set_dirty(true);

    Ok(key)
}

fn handle_wildcard_insert_preassigned(
    node: &mut RadixTreeNode,
    method: HttpMethod,
    index: usize,
    total_segments: usize,
    assigned_key: u16,
) -> Result<u16, RouterError> {
    if index != total_segments - 1 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardSegmentNotAtEnd,
            format!(
                "Wildcard segment '*' must be the final segment; found at index {} of {}",
                index, total_segments
            ),
            Some(
                json!({"operation":"handle_wildcard_insert_preassigned","index": index, "total_segments": total_segments}),
            ),
        ));
    }
    let method_idx = method as usize;
    if node.wildcard_routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardAlreadyExistsForMethod,
            "Wildcard route already exists for this method at the node".to_string(),
            Some(json!({"operation":"handle_wildcard_insert_preassigned","method":method as u8})),
        ));
    }
    node.wildcard_routes[method_idx] = assigned_key + 1;
    node.set_dirty(true);
    Ok(assigned_key)
}

fn assign_route_key(
    node: &mut RadixTreeNode,
    method: HttpMethod,
    next_route_key: &AtomicU16,
) -> Result<u16, RouterError> {
    let method_idx = method as usize;
    if node.routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteConflictOnDuplicatePath,
            "A route already exists for this path and method".to_string(),
            Some(json!({"operation":"assign_route_key","method": method as u8})),
        ));
    }
    let current_key = next_route_key.load(std::sync::atomic::Ordering::Relaxed);
    if current_key >= MAX_ROUTES {
        return Err(RouterError::new(
            RouterErrorCode::MaxRoutesExceeded,
            "Maximum number of routes exceeded".to_string(),
            Some(json!({"operation":"assign_route_key","current_key": current_key})),
        ));
    }
    let key = next_route_key.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    node.routes[method_idx] = key + 1;

    let current_mask = node.method_mask();
    node.set_method_mask(current_mask | (1 << method_idx));
    node.set_dirty(true);

    Ok(key)
}

fn assign_route_key_preassigned(
    node: &mut RadixTreeNode,
    method: HttpMethod,
    assigned_key: u16,
) -> Result<u16, RouterError> {
    let method_idx = method as usize;
    if node.routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteConflictOnDuplicatePath,
            format!(
                "A route already exists for this path and method when preassigning key={}",
                assigned_key
            ),
            Some(json!({"operation":"assign_route_key_preassigned","assigned_key": assigned_key})),
        ));
    }
    node.routes[method_idx] = assigned_key + 1;
    node.set_dirty(true);
    Ok(assigned_key)
}

// Helper for SegmentPart
impl SegmentPart {
    fn is_literal(&self) -> bool {
        matches!(self, SegmentPart::Literal(_))
    }
}

// Thread-safe standalone parser for bulk preprocess
pub(super) fn prepare_path_segments_standalone(
    path: &str,
) -> Result<Vec<SegmentPattern>, RouterError> {
    if path.is_empty() {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathEmpty,
            "The provided route path is empty".to_string(),
            Some(json!({"operation":"prepare_path_segments_standalone","path": path})),
        ));
    }
    if !path.is_ascii() {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathNotAscii,
            "The route path is not ASCII".to_string(),
            Some(json!({"operation":"prepare_path_segments_standalone","path": path})),
        ));
    }

    let norm = crate::router::path::normalize_path(path);
    // Reject paths with empty segments (e.g., "/a//b")
    if norm.contains("//") {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathSyntaxInvalid,
            "Route path contains empty segments (e.g., '//')".to_string(),
            Some(json!({"operation":"prepare_path_segments_standalone","path": path})),
        ));
    }
    if !crate::router::path::is_path_character_allowed(&norm) {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathContainsDisallowedCharacters,
            "Route path contains disallowed characters".to_string(),
            Some(json!({"operation":"prepare_path_segments_standalone","path": path})),
        ));
    }

    if norm == "/" {
        return Ok(Vec::new());
    }

    let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathSyntaxInvalid,
            "Route path syntax invalid after normalization".to_string(),
            Some(json!({"operation":"prepare_path_segments_standalone","path": path})),
        ));
    }

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
            return Err(RouterError::new(
                RouterErrorCode::PatternTooLong,
                format!(
                    "Pattern length exceeds allowed limits for segment '{}' in path '{}'",
                    seg, path
                ),
                Some(
                    json!({"operation":"prepare_path_segments_standalone","path": path, "segment": seg}),
                ),
            ));
        }

        for part in &pat.parts {
            if let SegmentPart::Param { name, .. } = part {
                if seen_params.contains(name.as_str()) {
                    return Err(RouterError::new(
                        RouterErrorCode::RouteDuplicateParamNameInRoute,
                        format!("Duplicate parameter name '{}' in route '{}'", name, path),
                        Some(
                            json!({"operation":"prepare_path_segments_standalone","param": name, "path": path}),
                        ),
                    ));
                }
                seen_params.insert(name.clone());
            }
        }
        parsed_segments.push(pat);
    }
    Ok(parsed_segments)
}
