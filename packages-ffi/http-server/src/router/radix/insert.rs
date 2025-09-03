//! Route insertion and segment parsing.

use regex::Regex;

use crate::router::errors::InsertError;
use crate::router::pattern::{
    SegmentPart, SegmentPattern, pattern_compatible_policy, pattern_is_pure_static, pattern_score,
};
use crate::router::regex_guard::{anchor_and_compile, normalize_anchor, validate_regex_safe};

use super::node::RadixNode;
use super::{RadixRouter, method_index};

impl RadixRouter {
    pub fn insert(
        &mut self,
        method: super::super::Method,
        path: &str,
        key: u64,
    ) -> Result<(), InsertError> {
        if self.root.sealed {
            return Err(InsertError::Syntax);
        }

        if path == "/" {
            let idx = method_index(method);
            if self.root.routes[idx] != 0 {
                return Err(InsertError::Syntax);
            }
            self.root.routes[idx] = key;
            return Ok(());
        }

        let norm = super::super::normalize_path(path, &self.options);

        let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
        if segments.is_empty() {
            return Err(InsertError::Syntax);
        }

        let case_sensitive = self.options.case_sensitive;

        let mut parsed_segments = Vec::new();
        for seg in segments.iter() {
            let pat = self.parse_segment(seg)?;
            parsed_segments.push(pat);
        }

        let mut current = &mut self.root;
        let mut _total_params = 0usize;

        for (i, (seg, pat)) in segments.iter().zip(parsed_segments.iter()).enumerate() {
            if *seg == "*" {
                if i != segments.len() - 1 {
                    return Err(InsertError::WildcardPosition);
                }
                let idx = method_index(method);
                if current.wildcard_routes[idx] != 0 {
                    return Err(InsertError::Conflict);
                }
                current.wildcard_routes[idx] = key;
                return Ok(());
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
                current = current.descend_static_mut(key_seg);
            } else {
                let has_incompatible = current
                    .pattern_children
                    .iter()
                    .any(|(exist, _)| !pattern_compatible_policy(exist, pat));
                if has_incompatible {
                    return Err(InsertError::Conflict);
                }

                if i == segments.len() - 1 {
                    'outer: for (exist, _) in current.pattern_children.iter() {
                        if exist.parts.len() != pat.parts.len() {
                            continue;
                        }
                        for (ea, eb) in exist.parts.iter().zip(pat.parts.iter()) {
                            match (ea, eb) {
                                (SegmentPart::Literal(la), SegmentPart::Literal(lb)) => {
                                    if la != lb {
                                        continue 'outer;
                                    }
                                }
                                (SegmentPart::Param { .. }, SegmentPart::Param { .. }) => {}
                                _ => {
                                    continue 'outer;
                                }
                            }
                        }
                        for (ea, eb) in exist.parts.iter().zip(pat.parts.iter()) {
                            if let (
                                SegmentPart::Param { regex: ra, .. },
                                SegmentPart::Param { regex: rb, .. },
                            ) = (ea, eb)
                            {
                                match (ra, rb) {
                                    (None, None) => {}
                                    (Some(x), Some(y)) => {
                                        if x.as_str() != y.as_str() {
                                            return Err(InsertError::Conflict);
                                        }
                                    }
                                    _ => {
                                        return Err(InsertError::Conflict);
                                    }
                                }
                            }
                        }
                    }
                }

                if let Some(existing_idx) = current
                    .pattern_children
                    .iter()
                    .position(|(exist, _)| exist == pat)
                {
                    let child_ptr: *mut RadixNode =
                        current.pattern_children[existing_idx].1.as_mut();
                    unsafe {
                        current = &mut *child_ptr;
                    }
                    continue;
                }

                if current.pattern_scores.len() != current.pattern_children.len() {
                    current.rebuild_pattern_meta();
                }

                let score = pattern_score(pat);
                let pos_opt = current.pattern_scores.iter().position(|&sc| sc < score);
                let insert_pos = pos_opt.unwrap_or(current.pattern_children.len());
                current
                    .pattern_children
                    .insert(insert_pos, (pat.clone(), Box::new(RadixNode::default())));
                current.pattern_scores.insert(insert_pos, score);
                current.rebuild_pattern_index();
                let child_ptr: *mut RadixNode = current.pattern_children[insert_pos].1.as_mut();
                unsafe {
                    current = &mut *child_ptr;
                }
            }
        }

        let idx = method_index(method);
        if current.routes[idx] != 0 {
            return Err(InsertError::Conflict);
        }
        current.routes[idx] = key;
        Ok(())
    }

    fn get_or_compile_regex(&self, re_str: &str) -> Result<Regex, InsertError> {
        let norm = normalize_anchor(re_str);
        anchor_and_compile(&norm, &self.regex_cache, None, &self.regex_clock)
    }

    pub(super) fn parse_segment(&self, seg: &str) -> Result<SegmentPattern, InsertError> {
        let mut parts: Vec<SegmentPart> = Vec::new();
        let mut i = 0usize;
        let bytes = seg.as_bytes();
        let mut lit_start: Option<usize> = None;
        while i < bytes.len() {
            let c = bytes[i] as char;
            if c == ':' {
                if let Some(ls) = lit_start.take() {
                    let lit = &seg[ls..i];
                    if !lit.is_empty() {
                        let lit_norm = if self.options.case_sensitive {
                            lit.to_string()
                        } else {
                            lit.to_ascii_lowercase()
                        };
                        parts.push(SegmentPart::Literal(lit_norm));
                    }
                }
                let mut j = i + 1;
                while j < bytes.len() {
                    let cj = bytes[j] as char;
                    if cj == '(' || cj == ':' || cj == ')' {
                        break;
                    }
                    j += 1;
                }
                if j > bytes.len() {
                    return Err(InsertError::Syntax);
                }
                let name = &seg[i + 1..j];

                let mut regex_opt: Option<Regex> = None;
                if j < bytes.len() && bytes[j] as char == '(' {
                    let close = seg[j + 1..]
                        .find(')')
                        .map(|p| j + 1 + p)
                        .ok_or(InsertError::Syntax)?;
                    let re_str = &seg[j + 1..close];
                    if !self.options.allow_unsafe_regex && !validate_regex_safe(re_str) {
                        return Err(InsertError::UnsafeRegex);
                    }
                    regex_opt = Some(self.get_or_compile_regex(re_str)?);
                    if close + 1 < bytes.len() {
                        let q = bytes[close + 1] as char;
                        if q == '+' || q == '*' || q == '?' || q == '{' {
                            return Err(InsertError::UnsafeRegex);
                        }
                    }
                    i = close + 1;
                } else {
                    i = j;
                }
                parts.push(SegmentPart::Param {
                    name: name.to_string(),
                    regex: regex_opt,
                });
                continue;
            }
            if lit_start.is_none() {
                lit_start = Some(i);
            }
            i += 1;
        }
        if let Some(ls) = lit_start.take() {
            let lit = &seg[ls..];
            if !lit.is_empty() {
                let lit_norm = if self.options.case_sensitive {
                    lit.to_string()
                } else {
                    lit.to_ascii_lowercase()
                };
                parts.push(SegmentPart::Literal(lit_norm));
            }
        }
        if parts.is_empty() {
            let lit_norm = if self.options.case_sensitive {
                seg.to_string()
            } else {
                seg.to_ascii_lowercase()
            };
            parts.push(SegmentPart::Literal(lit_norm));
        }
        Ok(SegmentPattern { parts })
    }
}
