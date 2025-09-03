use hashbrown::HashMap as FastHashMap;
use smallvec::SmallVec;

use crate::router::pattern::{SegmentPart, SegmentPattern, pattern_score};

use super::METHOD_COUNT;

pub(super) type StaticMap = FastHashMap<String, Box<RadixNode>>;

#[derive(Debug, Default)]
pub struct RadixNode {
    // optimize small number of siblings before promoting to map
    pub(super) static_keys: SmallVec<[String; 4]>,
    pub(super) static_vals: SmallVec<[Box<RadixNode>; 4]>,
    pub(super) static_children: StaticMap,
    pub(super) pattern_children: Vec<(SegmentPattern, Box<RadixNode>)>,
    // first literal -> indices in pattern_children (to reduce regex calls)
    pub(super) pattern_first_literal: FastHashMap<String, SmallVec<[usize; 4]>>,
    // cached specificity scores aligned with pattern_children
    pub(super) pattern_scores: SmallVec<[usize; 8]>,
    pub(super) routes: [u64; METHOD_COUNT],
    pub(super) wildcard_routes: [u64; METHOD_COUNT],
    pub(super) sealed: bool,
    // prefix compression (set by compress())
    pub(super) fused_edge: Option<String>,
    pub(super) fused_child: Option<Box<RadixNode>>,
}

impl RadixNode {
    pub(super) fn get_static_ref(&self, key: &str) -> Option<&RadixNode> {
        if let Some(n) = self.static_children.get(key) {
            return Some(n.as_ref());
        }
        if let Some(pos) = self.static_keys.iter().position(|k| k.as_str() == key) {
            return Some(self.static_vals[pos].as_ref());
        }
        None
    }

    pub(super) fn descend_static_mut(&mut self, key: String) -> &mut RadixNode {
        if self.static_children.is_empty() && self.static_keys.len() < 4 {
            if let Some(pos) = self.static_keys.iter().position(|k| k == &key) {
                return self.static_vals[pos].as_mut();
            }
            self.static_keys.push(key);
            self.static_vals.push(Box::new(RadixNode::default()));
            let last = self.static_vals.len() - 1;
            return self.static_vals[last].as_mut();
        }
        if self.static_children.is_empty() && !self.static_keys.is_empty() {
            for (k, v) in self.static_keys.drain(..).zip(self.static_vals.drain(..)) {
                self.static_children.insert(k, v);
            }
        }
        self.static_children
            .entry(key)
            .or_insert_with(|| Box::new(RadixNode::default()))
            .as_mut()
    }

    pub(super) fn rebuild_pattern_index(&mut self) {
        self.pattern_first_literal.clear();
        for (idx, (pat, _)) in self.pattern_children.iter().enumerate() {
            if let Some(SegmentPart::Literal(l0)) = pat.parts.first() {
                let entry = self
                    .pattern_first_literal
                    .entry(l0.clone())
                    .or_insert_with(SmallVec::new);
                entry.push(idx);
            }
        }
    }

    pub(super) fn rebuild_pattern_meta(&mut self) {
        self.pattern_scores.clear();
        self.pattern_scores.reserve(self.pattern_children.len());
        for (pat, _) in self.pattern_children.iter() {
            self.pattern_scores.push(pattern_score(pat));
        }
    }

    pub(super) fn pattern_candidates_for(&self, comp: &str) -> SmallVec<[usize; 8]> {
        let mut out: SmallVec<[usize; 8]> = SmallVec::new();
        // exact literal key
        if let Some(v) = self.pattern_first_literal.get(comp) {
            for &i in v.iter() {
                out.push(i);
            }
            return out;
        }
        // prefix matches
        for (lit, idxs) in self.pattern_first_literal.iter() {
            if comp.len() >= lit.len() && &comp[..lit.len()] == lit.as_str() {
                for &i in idxs.iter() {
                    out.push(i);
                }
            }
        }
        out
    }
}

// removed unused helper methods
