use super::{RadixTree, node::RadixTreeNode, alloc::NodeBox, HTTP_METHOD_COUNT, STATIC_MAP_THRESHOLD};
use crate::router::interner::Interner;
use hashbrown::HashMap as FastHashMap;

const TRAVERSAL_STACK_CAPACITY: usize = 1024;

pub(super) fn finalize(tree: &mut RadixTree) {
    if tree.root_node.is_sealed() {
        return;
    }

    // First, rebuild all pattern metadata and indices across the tree
    // so that the auto-optimization logic can make correct decisions.
    traverse_mut(&mut tree.root_node, |node| {
        rebuild_pattern_meta(node);
        rebuild_pattern_index(node);
    });

    // --- Automatic Optimization Logic ---
    if tree.options.enable_automatic_optimization {
        // 1. Auto-enable root pruning
        let has_root_param_or_wildcard = {
            let n = &tree.root_node;
            let mut has_dynamic = false;
            for m in 0..HTTP_METHOD_COUNT {
                if n.wildcard_routes[m] != 0 {
                    has_dynamic = true;
                    break;
                }
            }
            if !has_dynamic {
                has_dynamic = !n.pattern_param_first.is_empty();
            }
            has_dynamic
        };

        if !has_root_param_or_wildcard {
            tree.enable_root_level_pruning = true;
        }

        // 2. Auto-enable static full map based on heuristics
        let mut static_route_count = 0;
        count_static(&tree.root_node, &mut static_route_count);

        if static_route_count >= STATIC_MAP_THRESHOLD {
            tree.enable_static_route_full_mapping = true;
        }
    }
    // --- End of Automatic Optimization Logic ---

    tree.root_node.set_sealed(true);
    compress_tree(tree);
    
    // Set all nodes as dirty to rebuild indices
    traverse_mut(&mut tree.root_node, |node| {
        node.set_dirty(true);
    });
    
    sort_node(&mut tree.root_node, &tree.interner);
    build_indices(tree);
    
    // build root-level bitmaps and flags for pruning
    tree.method_first_byte_bitmaps = [[0; 4]; HTTP_METHOD_COUNT];
    tree.root_parameter_first_present = [false; HTTP_METHOD_COUNT];
    tree.root_wildcard_present = [false; HTTP_METHOD_COUNT];
    tree.method_length_buckets = [0; HTTP_METHOD_COUNT];
    
    build_pruning_maps(tree);

    shrink_node(&mut tree.root_node);
    
    // Optional cache warm-up to reduce first-hit latency
    warm_node(&tree.root_node);
    
    // Build static full maps for O(1) lookup when path is entirely static
    build_static_map(tree);
}

fn compress_tree(tree: &mut RadixTree) {
    invalidate_all_indices(tree);
    compress_root_node(&mut tree.root_node);
}

fn build_indices(tree: &mut RadixTree) {
    traverse_mut(&mut tree.root_node, |node| {
        if node.is_dirty() {
            node.set_method_mask(0);
            node.static_vals_idx.clear();
            node.static_children_idx.clear();
            node.pattern_children_idx.clear();
            node.fused_child_idx = None;
            if !node.static_keys.is_empty() {
                let mut tmp_idxs: smallvec::SmallVec<[NodeBox; 16]> = smallvec::SmallVec::new();
                tmp_idxs.reserve(node.static_vals.len());
                for child in node.static_vals.iter() {
                    tmp_idxs.push(NodeBox(child.0));
                }
                node.static_vals_idx.extend(tmp_idxs);
            }
            if !node.static_children.is_empty() {
                let keys: smallvec::SmallVec<[String; 16]> =
                    node.static_children.keys().cloned().collect();
                for k in keys {
                    if let Some(v) = node.static_children.get(&k) {
                        node.static_children_idx.insert(k, NodeBox(v.0));
                    }
                }
            }
            if !node.patterns.is_empty() {
                node.pattern_children_idx.clear();
                node.pattern_children_idx.reserve(node.patterns.len());
                for i in 0..node.patterns.len() {
                    node.pattern_children_idx.push(i);
                }
            }
            if let Some(fc) = node.fused_child.as_ref() {
                node.fused_child_idx = Some(NodeBox(fc.0));
            }
            // Inlined rebuild_intern_ids call requires access to `tree.interner`,
            // so we cannot pass this whole block as a closure to traverse_mut.
            // rebuild_intern_ids(node, &tree.interner); 
            node.set_dirty(false);
        }
    });

    let interner = &tree.interner;
    traverse_mut(&mut tree.root_node, |node| {
        if !node.is_dirty() { // Only run on nodes processed above
            rebuild_intern_ids(node, interner);
        }
    });

    // post-order pass to compute method masks accurately
    compute_mask(&mut tree.root_node);
}

fn invalidate_all_indices(tree: &mut RadixTree) {
    traverse_mut(&mut tree.root_node, |node| {
        node.static_vals_idx.clear();
        node.static_children_idx.clear();
        node.pattern_children_idx.clear();
        node.fused_child_idx = None;
    });
}

fn compute_mask(n: &mut RadixTreeNode) -> u8 {
    let mut m: u8 = 0;
    for i in 0..HTTP_METHOD_COUNT {
        if n.routes[i] != 0 || n.wildcard_routes[i] != 0 {
            m |= 1 << i;
        }
    }
    for child in n.static_vals.iter_mut() {
        m |= compute_mask(child.as_mut());
    }
    for (_, v) in n.static_children.iter_mut() {
        m |= compute_mask(v.as_mut());
    }
    for nb in n.pattern_nodes.iter_mut() {
        m |= compute_mask(nb.as_mut());
    }
    if let Some(fc) = n.fused_child.as_mut() {
        m |= compute_mask(fc.as_mut());
    }
    n.set_method_mask(m);
    m
}

fn count_static(root: &RadixTreeNode, count: &mut usize) {
    traverse(root, |n| {
        for i in 0..HTTP_METHOD_COUNT {
            if n.routes[i] != 0 {
                *count += 1;
            }
        }
    });
}

fn sort_node(n: &mut RadixTreeNode, interner: &Interner) {
    if !n.static_keys.is_empty() && n.static_keys.len() == n.static_vals.len() {
        let mut pairs: Vec<(u32, String, NodeBox)> = n
            .static_keys
            .iter()
            .cloned()
            .zip(n.static_vals.iter().map(|nb| NodeBox(nb.0)))
            .map(|(k, v)| (interner.intern(k.as_str()), k, v))
            .collect();
        pairs.sort_unstable_by(|a, b| a.0.cmp(&b.0));
        n.static_keys.clear();
        n.static_vals.clear();
        for (_id, k, v) in pairs.into_iter() {
            n.static_keys.push(k);
            n.static_vals.push(v);
        }
    }
    for (_, v) in n.static_children.iter_mut() {
        sort_node(v.as_mut(), interner);
    }
    for nb in n.pattern_nodes.iter_mut() {
        sort_node(nb.as_mut(), interner);
    }
    if let Some(fc) = n.fused_child.as_mut() {
        sort_node(fc.as_mut(), interner);
    }
}

fn build_pruning_maps(tree: &mut RadixTree) {
    let n = &tree.root_node;
    for m in 0..HTTP_METHOD_COUNT {
        if n.wildcard_routes[m] != 0 {
            tree.root_wildcard_present[m] = true;
        }
    }
    if let Some(edge) = n.fused_edge.as_ref() {
        if let Some(&b0) = edge.as_str().as_bytes().first() {
            let b = b0;
            let blk = (b as usize) >> 6;
            let bit = 1u64 << ((b as usize) & 63);
            let mask = n.method_mask();
            for mi in 0..HTTP_METHOD_COUNT {
                if (mask & (1 << mi)) != 0 {
                    tree.method_first_byte_bitmaps[mi][blk] |= bit;
                }
            }
        }
        let l = edge.len().min(63) as u32;
        let mask = n.method_mask();
        for mi in 0..HTTP_METHOD_COUNT {
            if (mask & (1 << mi)) != 0 {
                tree.method_length_buckets[mi] |= 1u64 << l;
            }
        }
    }
    for k in n.static_keys.iter() {
        if let Some(&b) = k.as_bytes().first() {
            let blk = (b as usize) >> 6;
            let bit = 1u64 << ((b as usize) & 63);
            let mask = n.method_mask();
            for m in 0..HTTP_METHOD_COUNT {
                if (mask & (1 << m)) != 0 {
                    tree.method_first_byte_bitmaps[m][blk] |= bit;
                }
            }
        }
        let l = k.len().min(63) as u32;
        let mask = n.method_mask();
        for m in 0..HTTP_METHOD_COUNT {
            if (mask & (1 << m)) != 0 {
                tree.method_length_buckets[m] |= 1u64 << l;
            }
        }
    }
    for (k, _) in n.static_children.iter() {
        if let Some(&b) = k.as_bytes().first() {
            let blk = (b as usize) >> 6;
            let bit = 1u64 << ((b as usize) & 63);
            let mask = n.method_mask();
            for m in 0..HTTP_METHOD_COUNT {
                if (mask & (1 << m)) != 0 {
                    tree.method_first_byte_bitmaps[m][blk] |= bit;
                }
            }
        }
        let l = k.len().min(63) as u32;
        let mask = n.method_mask();
        for m in 0..HTTP_METHOD_COUNT {
            if (mask & (1 << m)) != 0 {
                tree.method_length_buckets[m] |= 1u64 << l;
            }
        }
    }
    for (&hb, _) in n.pattern_first_lit_head.iter() {
        let blk = (hb as usize) >> 6;
        let bit = 1u64 << ((hb as usize) & 63);
        let mask = n.method_mask();
        for m in 0..HTTP_METHOD_COUNT {
            if (mask & (1 << m)) != 0 {
                tree.method_first_byte_bitmaps[m][blk] |= bit;
            }
        }
    }
    for pat in n.patterns.iter() {
        if let Some(crate::router::pattern::SegmentPart::Literal(l0)) = pat.parts.first() {
            let l = l0.len().min(63) as u32;
            let mask = n.method_mask();
            for m in 0..HTTP_METHOD_COUNT {
                if (mask & (1 << m)) != 0 {
                    tree.method_length_buckets[m] |= 1u64 << l;
                }
            }
        }
    }
    if !n.pattern_param_first.is_empty() {
        let mask = n.method_mask();
        for m in 0..HTTP_METHOD_COUNT {
            if (mask & (1 << m)) != 0 {
                tree.root_parameter_first_present[m] = true;
            }
        }
    }
}

fn shrink_node(n: &mut RadixTreeNode) {
    n.static_keys.shrink_to_fit();
    n.static_vals.shrink_to_fit();
    n.static_vals_idx.shrink_to_fit();
    n.pattern_children_idx.shrink_to_fit();
    n.patterns.shrink_to_fit();
    n.pattern_nodes.shrink_to_fit();
    n.pattern_first_literal.shrink_to_fit();
    n.pattern_meta.shrink_to_fit();
    for (_, v) in n.static_children.iter_mut() {
        shrink_node(v.as_mut());
    }
    for nb in n.pattern_nodes.iter_mut() {
        shrink_node(nb.as_mut());
    }
    if let Some(fc) = n.fused_child.as_mut() {
        shrink_node(fc.as_mut());
    }
}

fn warm_node(root: &RadixTreeNode) {
    traverse(root, |n| {
        // touch children to pull into cache
        for v in n.static_vals.iter() {
            let _ = v.as_ref().routes[0];
        }
        for (_, v) in n.static_children.iter() {
            let _ = v.as_ref().routes[0];
        }
        for nb in n.pattern_nodes.iter() {
            let _ = nb.as_ref().routes[0];
        }
        if let Some(fc) = n.fused_child.as_ref() {
            let _ = fc.as_ref().routes[0];
        }
    });
}

fn build_static_map(tree: &mut RadixTree) {
    for m in 0..HTTP_METHOD_COUNT {
        tree.static_route_full_mapping[m].clear();
    }
    
    if tree.enable_static_route_full_mapping {
        let mut path_buf = String::from("");
        collect_static(
            &tree.root_node,
            &mut path_buf,
            &mut tree.static_route_full_mapping,
        );
    }
}

fn collect_static(
    n: &RadixTreeNode,
    buf: &mut String,
    maps: &mut [FastHashMap<String, u16>; HTTP_METHOD_COUNT],
) {
    let base_len = buf.len();
    if let Some(edge) = n.fused_edge.as_ref() {
        if buf.is_empty() {
            buf.push('/');
        }
        buf.push_str(edge.as_str());
    }
    for (i, &rk) in n.routes.iter().enumerate() {
        if rk != 0 {
            let key = if buf.is_empty() { "/".to_string() } else { buf.clone() };
            maps[i].insert(key, rk);
        }
    }
    if !n.static_keys.is_empty() && n.static_vals_idx.len() == n.static_keys.len() {
        for (k_idx, nb) in n.static_keys.iter().zip(n.static_vals_idx.iter()) {
            let prev = buf.len();
            buf.push('/');
            buf.push_str(k_idx.as_str());
            collect_static(nb.as_ref(), buf, maps);
            buf.truncate(prev);
        }
    }
    for (k, v) in n.static_children.iter() {
        let prev = buf.len();
        buf.push('/');
        buf.push_str(k.as_str());
        collect_static(v.as_ref(), buf, maps);
        buf.truncate(prev);
    }
    if let Some(fc) = n.fused_child.as_ref() {
        collect_static(fc.as_ref(), buf, maps);
    }
    buf.truncate(base_len);
}


// Compression logic moved from compress.rs
fn can_compress_here(n: &RadixTreeNode) -> bool {
    n.patterns.is_empty()
        && !n.routes.iter().any(|k| *k != 0)
        && !n.wildcard_routes.iter().any(|k| *k != 0)
        && n.static_children.len() <= 1
        && n.static_keys.len() <= 1
}

fn compress_node(n: &mut RadixTreeNode) {
    if let Some(c) = n.pattern_nodes.first_mut() {
        compress_node(c.as_mut());
    }
    if !n.static_children.is_empty() {
        for (_, v) in n.static_children.iter_mut() {
            compress_node(v.as_mut());
        }
    } else {
        for v in n.static_vals.iter_mut() {
            compress_node(v.as_mut());
        }
    }

    if n.fused_edge.is_some() {
        return;
    }
    if !can_compress_here(n) {
        return;
    }

    let (mut edge, mut child) = if !n.static_children.is_empty() {
        if n.static_children.len() != 1 {
            return;
        }
        let (k, c) = n.static_children.drain().next().unwrap();
        (k, c)
    } else if !n.static_keys.is_empty() {
        if n.static_keys.len() != 1 {
            return;
        }
        let k = n.static_keys.pop().unwrap();
        let c = n.static_vals.pop().unwrap();
        (k, c)
    } else {
        return;
    };

    loop {
        let terminal =
            child.routes.iter().any(|k| *k != 0) || child.wildcard_routes.iter().any(|k| *k != 0);
        if child.patterns.is_empty() && !terminal {
            if !child.static_children.is_empty() && child.static_children.len() == 1 {
                let (k2, c2) = child.static_children.drain().next().unwrap();
                edge.push('/');
                edge.push_str(&k2);
                child = c2;
                continue;
            }
            if !child.static_keys.is_empty() && child.static_keys.len() == 1 {
                let k2 = child.static_keys.pop().unwrap();
                let c2 = child.static_vals.pop().unwrap();
                edge.push('/');
                edge.push_str(&k2);
                child = c2;
                continue;
            }
        }
        break;
    }
    n.fused_edge = Some(edge);
    n.fused_child = Some(child);
}

fn compress_root_node(root: &mut RadixTreeNode) {
    compress_node(root);
}

pub(super) fn rebuild_intern_ids(node: &mut RadixTreeNode, interner: &Interner) {
    node.static_key_ids.clear();
    node.static_hash_table.clear();
    node.static_hash_seed = 0;

    if !node.static_keys.is_empty() {
        node.static_key_ids.reserve(node.static_keys.len());

        for k in node.static_keys.iter() {
            node.static_key_ids.push(interner.intern(k.as_str()));
        }

        if node.static_vals_idx.len() == node.static_keys.len() && node.static_keys.len() >= 16
        {
            let mut size: usize = (node.static_keys.len() * 2).next_power_of_two();
            let max_size: usize = node.static_keys.len() * 8;
            let mut seed: u64 = 1469598103934665603;
            while size <= max_size {
                let mut table: Vec<i32> = vec![-1; size];
                let mut ok = true;
                for (i, k) in node.static_keys.iter().enumerate() {
                    let mut h: u64 = seed;
                    for &b in k.as_bytes() {
                        h ^= b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }
                    let mut idx = (h as usize) & (size - 1);
                    let mut steps = 0usize;
                    while table[idx] != -1 {
                        idx = (idx + 1) & (size - 1);
                        steps += 1;
                        if steps > size {
                            ok = false;
                            break;
                        }
                    }
                    if !ok {
                        break;
                    }
                    table[idx] = i as i32;
                }
                if ok {
                    node.static_hash_seed = seed;
                    node.static_hash_table.clear();
                    node.static_hash_table.extend_from_slice(&table);
                    break;
                }
                seed = seed
                    .wrapping_mul(1315423911)
                    .wrapping_add(0x9e3779b97f4a7c15);
                size *= 2;
            }
        }
    }
    node.static_children_idx_ids.clear();
    if !node.static_children.is_empty() {
        for (k, v) in node.static_children.iter() {
            let id = interner.intern(k.as_str());
            node.static_children_idx_ids.insert(id, super::NodeBox(v.0));
        }
    }
}

#[inline]
pub(super) fn rebuild_pattern_index(node: &mut RadixTreeNode) {
    node.pattern_first_literal.clear();
    node.pattern_first_lit_head.clear();
    node.pattern_param_first.clear();

    for (idx, pat) in node.patterns.iter().enumerate() {
        if let Some(crate::router::pattern::SegmentPart::Literal(l0)) = pat.parts.first() {
            let entry = node
                .pattern_first_literal
                .entry(l0.clone())
                .or_insert_with(smallvec::SmallVec::new);
            entry.push(idx as u16);
            if let Some(&b) = l0.as_bytes().first() {
                let entry2 = node
                    .pattern_first_lit_head
                    .entry(b)
                    .or_insert_with(smallvec::SmallVec::new);
                entry2.push(idx as u16);
            }
        } else if let Some(crate::router::pattern::SegmentPart::Param { .. }) = pat.parts.first() {
            node.pattern_param_first.push(idx as u16);
        }
    }
}

#[inline]
pub(super) fn rebuild_pattern_meta(node: &mut RadixTreeNode) {
    node.pattern_meta.clear();
    node.pattern_meta.reserve(node.patterns.len());

    for pat in node.patterns.iter() {
        let score = crate::router::pattern::pattern_score(pat);

        let mut min_len = 0u16;
        for part in pat.parts.iter() {
            match part {
                crate::router::pattern::SegmentPart::Literal(l) => {
                    min_len += l.len() as u16;
                }
                crate::router::pattern::SegmentPart::Param { .. } => {}
            }
        }

        let mut last_len = 0u16;
        for part in pat.parts.iter().rev() {
            if let crate::router::pattern::SegmentPart::Literal(l) = part {
                last_len = l.len() as u16;
                break;
            }
        }
        
        let meta = super::node::PatternMeta::new(score, min_len, last_len);
        node.pattern_meta.push(meta);
    }

    debug_assert_eq!(node.patterns.len(), node.pattern_meta.len());
}

fn traverse<F>(root: &RadixTreeNode, mut action: F)
where
    F: FnMut(&RadixTreeNode),
{
    let mut stack: Vec<&RadixTreeNode> = Vec::with_capacity(TRAVERSAL_STACK_CAPACITY);
    stack.push(root);

    while let Some(node) = stack.pop() {
        action(node);

        for child in node.static_vals.iter() {
            stack.push(child.as_ref());
        }
        for (_, v) in node.static_children.iter() {
            stack.push(v.as_ref());
        }
        for nb in node.pattern_nodes.iter() {
            stack.push(nb.as_ref());
        }
        if let Some(fc) = node.fused_child.as_ref() {
            stack.push(fc.as_ref());
        }
    }
}

fn traverse_mut<F>(root: &mut RadixTreeNode, mut action: F)
where
    F: FnMut(&mut RadixTreeNode),
{
    let mut stack: Vec<*mut RadixTreeNode> = Vec::with_capacity(TRAVERSAL_STACK_CAPACITY);
    stack.push(root as *mut _);

    while let Some(ptr) = stack.pop() {
        let node = unsafe { &mut *ptr };
        action(node);

        for child in node.static_vals.iter_mut() {
            stack.push(child.as_mut() as *mut _);
        }
        for (_, v) in node.static_children.iter_mut() {
            stack.push(v.as_mut() as *mut _);
        }
        for nb in node.pattern_nodes.iter_mut() {
            stack.push(nb.as_mut() as *mut _);
        }
        if let Some(fc) = node.fused_child.as_mut() {
            stack.push(fc.as_mut() as *mut _);
        }
    }
}
