//! Route insertion and segment parsing.

use regex::Regex;

use crate::router::errors::InsertError;
use crate::router::pattern::{SegmentPart, SegmentPattern, pattern_score, pattern_compatible_policy, pattern_is_pure_static};
use crate::router::regex_guard::{anchor_and_compile, normalize_anchor, validate_regex_safe};

use super::{method_index, RadixRouter};
use super::node::RadixNode;

impl RadixRouter {
    /// Insert a new route into the radix tree.
    ///
    /// Steps:
    /// - Normalize path; split into segments
    /// - For each segment: if "*" then register wildcard (must be last)
    /// - For static-only parts: use static child map
    /// - For patterns: ensure compatibility policy, maintain score order
    ///   and rebuild first-literal index
    pub fn insert(&mut self, method: super::super::Method, path: &str, key: u64) -> Result<(), InsertError> {
        if self.root.sealed { return Err(InsertError::Syntax); }
        let norm = super::super::normalize_path(path, &self.options);
        if norm.len() > self.options.max_path_length { return Err(InsertError::Syntax); }
        let segments: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
        if segments.is_empty() { return Err(InsertError::Syntax); }

        // use raw pointer traversal to avoid borrow conflicts
        let mut node_ptr: *mut RadixNode = &mut self.root;
        let mut total_params = 0usize;
        for (i, seg) in segments.iter().enumerate() {
            if *seg == "*" {
                if i != segments.len() - 1 { return Err(InsertError::WildcardPosition); }
                unsafe {
                    let node = &mut *node_ptr;
                    let idx = method_index(method);
                    if node.wildcard_routes[idx] != 0 { return Err(InsertError::Conflict); }
                    node.wildcard_routes[idx] = key;
                }
                return Ok(());
            }

            let key_seg = if self.options.case_sensitive { (*seg).to_string() } else { seg.to_ascii_lowercase() };
            let pat = self.parse_segment(seg)?;
            // count params in this segment
            for part in pat.parts.iter() { if let SegmentPart::Param { .. } = part { total_params += 1; } }
            if total_params > self.options.max_total_params { return Err(InsertError::Syntax); }

            // fast path: pure static
            if pattern_is_pure_static(&pat, &key_seg) {
                unsafe {
                    let node = &mut *node_ptr;
                    let next = node.descend_static_mut(key_seg);
                    node_ptr = next as *mut _;
                }
                continue;
            }

            // pattern path
            unsafe {
                let node = &mut *node_ptr;
                for (exist, _) in node.pattern_children.iter() {
                    if !pattern_compatible_policy(exist, &pat, self.options.strict_param_names) { return Err(InsertError::Conflict); }
                }
                // compute or reuse cached scores
                if node.pattern_scores.len() != node.pattern_children.len() { node.rebuild_pattern_meta(); }
                let score = pattern_score(&pat);
                let pos = node.pattern_scores.iter().position(|&sc| sc < score).unwrap_or(node.pattern_children.len());
                node.pattern_children.insert(pos, (pat, Box::new(RadixNode::default())));
                node.pattern_scores.insert(pos, score);
                node.rebuild_pattern_index();
                node_ptr = &mut *node.pattern_children[pos].1 as *mut _;
            }
        }

        unsafe {
            let node = &mut *node_ptr;
            let idx = method_index(method);
            if node.routes[idx] != 0 { return Err(InsertError::Conflict); }
            node.routes[idx] = key;
        }
        Ok(())
    }

    /// Return a compiled regex from cache or compile-and-cache after anchoring.
    fn get_or_compile_regex(&self, re_str: &str) -> Result<Regex, InsertError> {
        let norm = normalize_anchor(re_str);
        anchor_and_compile(&norm, &self.regex_cache, Some(self.options.regex_cache_capacity), &self.regex_clock)
    }

    /// Parse a path segment into a `SegmentPattern` according to current options.
    pub(super) fn parse_segment(&self, seg: &str) -> Result<SegmentPattern, InsertError> {
        // split into alternating literal and param parts, support multiple params per segment
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
                        let lit_norm = if self.options.case_sensitive { lit.to_string() } else { lit.to_ascii_lowercase() };
                        parts.push(SegmentPart::Literal(lit_norm));
                    }
                }
                // parse name
                let mut j = i + 1;
                while j < bytes.len() {
                    let cj = bytes[j] as char;
                    if cj == '(' || cj == ':' || cj == ')' { break; }
                    j += 1;
                }
                if j > bytes.len() { return Err(InsertError::Syntax); }
                let name = &seg[i + 1..j];
                let mut regex_opt: Option<Regex> = None;
                if j < bytes.len() && bytes[j] as char == '(' {
                    // find next ')' after j (no nested paren support)
                    let close = seg[j+1..].find(')').map(|p| j + 1 + p).ok_or(InsertError::Syntax)?;
                    let re_str = &seg[j + 1..close];
                    if !self.options.allow_unsafe_regex && !validate_regex_safe(re_str) { return Err(InsertError::UnsafeRegex); }
                    regex_opt = Some(self.get_or_compile_regex(re_str)?);
                    // forbid immediate quantifier after regex close: "+", "*", "?", "{"
                    if close + 1 < bytes.len() {
                        let q = bytes[close + 1] as char;
                        if q == '+' || q == '*' || q == '?' || q == '{' { return Err(InsertError::UnsafeRegex); }
                    }
                    i = close + 1;
                } else {
                    i = j;
                }
                parts.push(SegmentPart::Param { name: name.to_string(), regex: regex_opt });
                continue;
            }
            if lit_start.is_none() { lit_start = Some(i); }
            i += 1;
        }
        if let Some(ls) = lit_start.take() {
            let lit = &seg[ls..];
            if !lit.is_empty() {
                let lit_norm = if self.options.case_sensitive { lit.to_string() } else { lit.to_ascii_lowercase() };
                parts.push(SegmentPart::Literal(lit_norm));
            }
        }
        if parts.is_empty() {
            let lit_norm = if self.options.case_sensitive { seg.to_string() } else { seg.to_ascii_lowercase() };
            parts.push(SegmentPart::Literal(lit_norm));
        }
        Ok(SegmentPattern { parts })
    }
}


