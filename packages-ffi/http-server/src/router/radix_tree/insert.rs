use super::{
    MAX_ROUTES, RadixTree, RadixTreeNode, create_node_box_from_arena_pointer, node::PatternMeta,
};
use crate::enums::HttpMethod;
use crate::router::errors::RouterErrorCode;
use crate::router::interner::Interner;
use crate::router::pattern::{
    SegmentPart, SegmentPattern, pattern_compatible_policy, pattern_is_pure_static, pattern_score,
};
use crate::router::structures::RouterError;
use hashbrown::HashSet;
use serde_json::json;
use std::sync::atomic::AtomicU16;

impl RadixTree {
    pub fn insert(&mut self, method: HttpMethod, path: &str) -> Result<u16, RouterError> {
        tracing::event!(tracing::Level::TRACE, operation="insert", method=?method, path=%path);
        if self.root_node.is_sealed() {
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                "router",
                "route_registration", 
                "validation",
                format!("Router is sealed; cannot insert path '{}'", path),
                Some(json!({"path": path, "operation": "insert"})),
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
        tracing::event!(tracing::Level::TRACE, operation="insert_parsed", method=?method, segments=parsed_segments.len() as u64);
        if self.root_node.is_sealed() {
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                "router",
                "route_registration",
                "validation",
                "Router is sealed; cannot insert parsed segments".to_string(),
                Some(json!({"operation": "insert_parsed", "sealed": true})),
            ));
        }
        self.root_node.set_dirty(true);

        let mut current = &mut self.root_node;
        let arena_ptr: *const bumpalo::Bump = &self.arena;

        for (i, pat) in parsed_segments.iter().enumerate() {
            // Fast check without allocation: single literal '*' means wildcard
            let is_wildcard =
                matches!(pat.parts.as_slice(), [SegmentPart::Literal(s)] if s.as_str() == "*");
            if is_wildcard {
                return handle_wildcard_insert(
                    current,
                    method,
                    i,
                    parsed_segments.len(),
                    &self.next_route_key,
                );
            }

            // Detect pure static without building a joined string
            if pat.parts.len() == 1 {
                if let SegmentPart::Literal(lit) = &pat.parts[0] {
                    current = current.descend_static_mut_with_alloc(lit.as_str(), || {
                        create_node_box_from_arena_pointer(arena_ptr)
                    });
                    sort_static_children(current, &self.interner);
                } else {
                    current = find_or_create_pattern_child(current, pat, arena_ptr)?;
                }
            } else if pattern_is_pure_static(pat, "") {
                // Unlikely path; keep safety for helper parity
                let joined = pat
                    .parts
                    .iter()
                    .map(|p| match p {
                        SegmentPart::Literal(s) => s.as_str(),
                        _ => "",
                    })
                    .collect::<String>();
                current = current.descend_static_mut_with_alloc(joined.as_str(), || {
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
        tracing::event!(tracing::Level::TRACE, operation="insert_parsed_preassigned", method=?method, segments=parsed_segments.len() as u64, assigned_key=assigned_key as u64);
        if self.root_node.is_sealed() {
            return Err(RouterError::new(
                RouterErrorCode::RouterSealedCannotInsert,
                "router",
                "route_registration",
                "validation",
                format!(
                    "Router is sealed; cannot insert parsed segments preassigned key={}",
                    assigned_key
                ),
                Some(json!({"operation":"insert_parsed_preassigned","assigned_key": assigned_key, "sealed": true})),
            ));
        }
        self.root_node.set_dirty(true);

        let mut current = &mut self.root_node;
        let arena_ptr: *const bumpalo::Bump = &self.arena;

        for (i, pat) in parsed_segments.iter().enumerate() {
            let is_wildcard =
                matches!(pat.parts.as_slice(), [SegmentPart::Literal(s)] if s.as_str() == "*");
            if is_wildcard {
                return handle_wildcard_insert_preassigned(
                    current,
                    method,
                    i,
                    parsed_segments.len(),
                    assigned_key,
                );
            }

            if pat.parts.len() == 1 {
                if let SegmentPart::Literal(lit) = &pat.parts[0] {
                    current = current.descend_static_mut_with_alloc(&lit.clone(), || {
                        create_node_box_from_arena_pointer(arena_ptr)
                    });
                    sort_static_children(current, &self.interner);
                } else {
                    current = find_or_create_pattern_child(current, pat, arena_ptr)?;
                }
            } else if pattern_is_pure_static(pat, "") {
                let joined = pat
                    .parts
                    .iter()
                    .map(|p| match p {
                        SegmentPart::Literal(s) => s.as_str(),
                        _ => "",
                    })
                    .collect::<String>();
                current = current.descend_static_mut_with_alloc(&joined, || {
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
    let len = node.static_keys.len();
    if len == node.static_vals.len() && len > 1 {
        // Ensure key id cache is aligned; avoid repeated interner allocations
        if node.static_key_ids.len() != len {
            node.static_key_ids.clear();
            node.static_key_ids.reserve(len);
            for k in node.static_keys.iter() {
                node.static_key_ids.push(interner.intern(k));
            }
        }

        // Indices sorted by cached key ids
        let mut indices: Vec<usize> = (0..len).collect();
        indices.sort_unstable_by_key(|&i| node.static_key_ids[i]);

        // Move out keys/vals/ids without reallocating, then rebuild in order
        let mut old_keys = std::mem::take(&mut node.static_keys);
        let old_vals = std::mem::take(&mut node.static_vals);
        let old_ids = std::mem::take(&mut node.static_key_ids);

        node.static_keys.reserve(len);
        node.static_vals.reserve(len);
        node.static_key_ids.reserve(len);

        for &i in indices.iter() {
            node.static_keys.push(std::mem::take(&mut old_keys[i]));
            // NodeBox clone is a cheap pointer copy; avoids moving out of index
            node.static_vals.push(old_vals[i].clone());
            node.static_key_ids.push(old_ids[i]);
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
                "router",
                "route_registration",
                "validation",
                "Parameter name conflict at same position between patterns".to_string(),
                Some(json!({"conflict": "pattern_compatibility", "new_pattern": format!("{:?}", pat)})),
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
            "router",
            "route_registration",
            "validation",
            format!(
                "Wildcard segment '*' must be the final segment; found at index {} of {}",
                index, total_segments
            ),
            Some(json!({"index": index, "total_segments": total_segments, "operation": "wildcard_insert"})),
        ));
    }
    let method_idx = method as usize;
    if node.wildcard_routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardAlreadyExistsForMethod,
            "router",
            "route_registration",
            "validation",
            "Wildcard route already exists for this method at the node".to_string(),
            Some(json!({"method":method as u8, "operation": "wildcard_insert"})),
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
            "router",
            "route_registration",
            "validation",
            format!(
                "Wildcard segment '*' must be the final segment; found at index {} of {}",
                index, total_segments
            ),
            Some(json!({"index": index, "total_segments": total_segments, "operation": "wildcard_insert_preassigned", "assigned_key": assigned_key})),
        ));
    }
    let method_idx = method as usize;
    if node.wildcard_routes[method_idx] != 0 {
        return Err(RouterError::new(
            RouterErrorCode::RouteWildcardAlreadyExistsForMethod,
            "router",
            "route_registration",
            "validation",
            "Wildcard route already exists for this method at the node".to_string(),
            Some(json!({"method":method as u8, "operation": "wildcard_insert_preassigned", "assigned_key": assigned_key})),
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
            "router",
            "route_registration",
            "validation",
            "A route already exists for this path and method".to_string(),
            Some(json!({"method": method as u8, "operation": "assign_route_key"})),
        ));
    }
    let current_key = next_route_key.load(std::sync::atomic::Ordering::Relaxed);
    if current_key >= MAX_ROUTES {
        return Err(RouterError::new(
            RouterErrorCode::MaxRoutesExceeded,
            "router",
            "route_registration",
            "validation",
            "Maximum number of routes exceeded".to_string(),
            Some(json!({"current_key": current_key, "maxRoutes": MAX_ROUTES, "operation": "assign_route_key"})),
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
            "router",
            "route_registration",
            "validation",
            format!(
                "A route already exists for this path and method when preassigning key={}",
                assigned_key
            ),
            Some(json!({"assigned_key": assigned_key, "method": method as u8, "operation": "assign_route_key_preassigned"})),
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
    // Use the unified path validation function
    let norm = match crate::router::path::normalize_and_validate_path(path) {
        Ok(normalized_path) => normalized_path,
        Err(mut err) => {
            // Update the error context for route registration
            err.stage = "route_registration".to_string();
            err.cause = "validation".to_string();
            if let Some(ref mut extra) = err.extra {
                if let Some(obj) = extra.as_object_mut() {
                    obj.insert("operation".to_string(), json!("path_parsing"));
                }
            }
            return Err(err);
        }
    };    if norm == "/" {
        return Ok(Vec::new());
    }

    let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return Err(RouterError::new(
            RouterErrorCode::RoutePathSyntaxInvalid,
            "router",
            "route_registration",
            "validation",
            "Route path syntax invalid after normalization".to_string(),
            Some(json!({"path": path, "normalized": norm, "operation": "path_parsing"})),
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
                "router",
                "route_registration",
                "validation",
                format!(
                    "Pattern length exceeds allowed limits for segment '{}' in path '{}'",
                    seg, path
                ),
                Some(json!({"path": path, "segment": seg, "min_len": min_len, "last_lit_len": last_lit_len, "operation": "pattern_validation"})),
            ));
        }

        for part in &pat.parts {
            if let SegmentPart::Param { name, .. } = part {
                if seen_params.contains(name.as_str()) {
                    return Err(RouterError::new(
                        RouterErrorCode::RouteDuplicateParamNameInRoute,
                        "router",
                        "route_registration", 
                        "validation",
                        format!("Duplicate parameter name '{}' in route '{}'", name, path),
                        Some(json!({"param": name, "path": path, "operation": "duplicate_param_check"})),
                    ));
                }
                seen_params.insert(name.clone());
            }
        }
        parsed_segments.push(pat);
    }
    Ok(parsed_segments)
}
