use crate::router::errors::RouterError;
use crate::router::pattern::{
    pattern_compatible_policy, pattern_is_pure_static, pattern_score, SegmentPart, SegmentPattern,
};

use super::new_node_box_from_arena_ptr;
use super::{RadixRouter};
use core::sync::atomic::Ordering;
use smallvec::SmallVec;

use crate::r#enum::HttpMethod;

impl RadixRouter {
    pub fn insert(&mut self, method: HttpMethod, path: &str) -> Result<u16, RouterError> {
        if self.root.sealed {
            return Err(RouterError::RouterSealedCannotInsert);
        }

        self.invalidate_indices();

        let method_idx = method as usize;

        if path == "/" {
            if self.root.routes[method_idx] != 0 {
                return Err(RouterError::RouteConflictOnDuplicatePath);
            }

            let key = self
                .next_key
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

            self.root.routes[method_idx] = key + 1;
            self.root.method_mask |= 1 << method_idx;
            self.root.dirty = true;
            return Ok(key);
        }

        if path.is_empty() {
            return Err(RouterError::RoutePathEmpty);
        }

        if !path.is_ascii() {
            return Err(RouterError::RoutePathNotAscii);
        }

        let norm = super::super::normalize_path(path);

        if !super::super::path_is_allowed_ascii(&norm) {
            return Err(RouterError::RoutePathContainsDisallowedCharacters);
        }

        let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();

        if segments.is_empty() {
            return Err(RouterError::RoutePathSyntaxInvalid);
        }

        let case_sensitive = self.options.case_sensitive;

        let mut parsed_segments: Vec<SegmentPattern> = Vec::new();
        let mut seen_params: hashbrown::HashSet<String> = hashbrown::HashSet::new();

        for seg in segments.iter() {
            let pat = self.parse_segment(seg)?;

            for part in pat.parts.iter() {
                if let SegmentPart::Param { name, .. } = part {
                    if seen_params.contains(name) {
                        return Err(RouterError::RouteDuplicateParamNameInRoute);
                    }

                    seen_params.insert(name.clone());
                }
            }

            parsed_segments.push(pat);
        }

        let mut current = &mut self.root;
        let arena_ptr: *const bumpalo::Bump = &self.arena;
        let mut _total_params = 0usize;

        for (i, (seg, pat)) in segments.iter().zip(parsed_segments.iter()).enumerate() {
            if *seg == "*" {
                if i != segments.len() - 1 {
                    return Err(RouterError::RouteWildcardSegmentNotAtEnd);
                }

                if current.wildcard_routes[method_idx] != 0 {
                    return Err(RouterError::RouteWildcardAlreadyExistsForMethod);
                }

                let key = self
                    .next_key
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

                current.wildcard_routes[method_idx] = key + 1;
                current.method_mask |= 1 << method_idx;
                current.dirty = true;

                return Ok(key);
            }

            let key_seg = if case_sensitive {
                (*seg).to_string()
            } else {
                seg.to_ascii_lowercase()
            };

            for part in pat.parts.iter() {
                if let SegmentPart::Param { .. } = part {
                    _total_params += 1;
                }
            }

            if pattern_is_pure_static(pat, &key_seg) {
                current = current.descend_static_mut_with_alloc(key_seg, || {
                    new_node_box_from_arena_ptr(arena_ptr)
                });
                current.method_mask |= 1 << method_idx;

                if current.static_keys.len() == current.static_vals.len() {
                    let interner = &self.interner;
                    let mut pairs: Vec<(u32, String, super::NodeBox)> = current
                        .static_keys
                        .iter()
                        .cloned()
                        .zip(current.static_vals.iter().map(|nb| super::NodeBox(nb.0)))
                        .map(|(k, v)| (interner.intern(k.as_str()), k, v))
                        .collect();
                    pairs.sort_unstable_by(|a, b| a.0.cmp(&b.0));
                    current.static_keys.clear();
                    current.static_vals.clear();

                    for (_id, k, v) in pairs.into_iter() {
                        current.static_keys.push(k);
                        current.static_vals.push(v);
                    }
                }

                current.dirty = true;
            } else {
                let shape_key = crate::router::pattern::pattern_shape_key(pat);
                let tmp: SmallVec<[usize; 8]> = SmallVec::new();
                let cand_indices: &[usize] =
                    if let Some(v) = current.pattern_shape_index.get(&shape_key) {
                        current.shape_hits.fetch_add(1, Ordering::Relaxed);
                        v.as_slice()
                    } else {
                        current.shape_misses.fetch_add(1, Ordering::Relaxed);
                        tmp.as_slice()
                    };

                if cand_indices.is_empty() {
                    for exist in current.patterns.iter() {
                        if !pattern_compatible_policy(exist, pat) {
                            return Err(RouterError::RouteParamNameConflictAtSamePosition);
                        }

                        if i == segments.len() - 1 {
                            for (ea, eb) in exist.parts.iter().zip(pat.parts.iter()) {
                                if let (SegmentPart::Param { .. }, SegmentPart::Param { .. }) =
                                    (ea, eb)
                                {}
                            }
                        }
                    }
                } else {
                    for &idx in cand_indices.iter() {
                        let exist = &current.patterns[idx];

                        if !pattern_compatible_policy(exist, pat) {
                            return Err(RouterError::RouteParamNameConflictAtSamePosition);
                        }

                        if i == segments.len() - 1 {
                            for (ea, eb) in exist.parts.iter().zip(pat.parts.iter()) {
                                if let (SegmentPart::Param { .. }, SegmentPart::Param { .. }) =
                                    (ea, eb)
                                {}
                            }
                        }
                    }
                }

                if let Some(existing_idx) = current.patterns.iter().position(|exist| exist == pat) {
                    let child = current
                        .pattern_nodes
                        .get_mut(existing_idx)
                        .unwrap()
                        .as_mut();

                    current = child;

                    continue;
                }

                if current.pattern_scores.len() != current.patterns.len() {
                    current.rebuild_pattern_meta();
                }

                let score = pattern_score(pat);
                let pos_opt = current.pattern_scores.iter().position(|&sc| sc < score);
                let insert_pos = pos_opt.unwrap_or(current.patterns.len());

                current.patterns.insert(insert_pos, pat.clone());
                current
                    .pattern_nodes
                    .insert(insert_pos, new_node_box_from_arena_ptr(arena_ptr));
                current.pattern_scores.insert(insert_pos, score);
                current.rebuild_pattern_index();
                current.rebuild_shape_indices();

                let child = current.pattern_nodes.get_mut(insert_pos).unwrap().as_mut();

                current.method_mask |= 1 << method_idx;
                current.dirty = true;
                current = child;
            }
        }

        if current.routes[method_idx] != 0 {
            return Err(RouterError::RouteConflictOnDuplicatePath);
        }

        let key = self
            .next_key
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        current.routes[method_idx] = key + 1;
        current.method_mask |= 1 << method_idx;
        current.dirty = true;

        Ok(key)
    }

    pub(super) fn parse_segment(&self, seg: &str) -> Result<SegmentPattern, RouterError> {
        if seg.contains('(') || seg.contains(')') {
            return Err(RouterError::RoutePathSyntaxInvalid);
        }

        let bytes = seg.as_bytes();

        if bytes.first().copied() == Some(b':') {
            let mut j = 1usize;

            if j >= bytes.len() {
                return Err(RouterError::RoutePathSyntaxInvalid);
            }

            while j < bytes.len() {
                let b = bytes[j];
                
                if !(b.is_ascii_alphanumeric() || b == b'_') {
                    break;
                }

                j += 1;
            }

            let name = &seg[1..];

            if name.contains(':') {
                return Err(RouterError::RoutePathSyntaxInvalid);
            }

            let nb = name.as_bytes();

            if nb.is_empty() {
                return Err(RouterError::RoutePathSyntaxInvalid);
            }

            if !(nb[0].is_ascii_alphabetic() || nb[0] == b'_') {
                return Err(RouterError::RouteParamNameInvalidStart);
            }
            
            for &c in &nb[1..] {
                if !(c.is_ascii_alphanumeric() || c == b'_') {
                    return Err(RouterError::RouteParamNameInvalidChar);
                }
            }

            return Ok(SegmentPattern {
                parts: vec![SegmentPart::Param {
                    name: name.to_string(),
                }],
            });
        }

        if seg.contains(':') {
            return Err(RouterError::RouteSegmentContainsMixedParamAndLiteral);
        }

        let lit_norm = if self.options.case_sensitive {
            seg.to_string()
        } else {
            seg.to_ascii_lowercase()
        };

        Ok(SegmentPattern {
            parts: vec![SegmentPart::Literal(lit_norm)],
        })
    }
}
