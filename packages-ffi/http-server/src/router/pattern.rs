use regex::Regex;

#[derive(Debug, Clone)]
pub enum SegmentPart {
    Literal(String),
    Param { name: String, regex: Option<Regex> },
}

#[derive(Debug, Clone)]
pub struct SegmentPattern {
    pub parts: Vec<SegmentPart>,
}

impl PartialEq for SegmentPattern {
    fn eq(&self, other: &Self) -> bool {
        if self.parts.len() != other.parts.len() {
            return false;
        }
        for (a, b) in self.parts.iter().zip(other.parts.iter()) {
            match (a, b) {
                (SegmentPart::Literal(la), SegmentPart::Literal(lb)) => {
                    if la != lb {
                        return false;
                    }
                }
                (
                    SegmentPart::Param {
                        name: na,
                        regex: ra,
                    },
                    SegmentPart::Param {
                        name: nb,
                        regex: rb,
                    },
                ) => {
                    if na != nb {
                        return false;
                    }
                    match (ra, rb) {
                        (None, None) => {}
                        (Some(x), Some(y)) => {
                            if x.as_str() != y.as_str() {
                                return false;
                            }
                        }
                        _ => {
                            return false;
                        }
                    }
                }
                _ => {
                    return false;
                }
            }
        }
        true
    }
}

pub fn pattern_score(p: &SegmentPattern) -> usize {
    let mut s = 0usize;
    for part in p.parts.iter() {
        match part {
            SegmentPart::Literal(l) => {
                s += 100 + l.len();
            }
            SegmentPart::Param { regex: None, .. } => {
                s += 10;
            }
            SegmentPart::Param { regex: Some(_), .. } => {
                s += 5;
            }
        }
    }
    s
}

pub fn pattern_compatible_policy(a: &SegmentPattern, b: &SegmentPattern) -> bool {
    if a.parts.len() != b.parts.len() {
        return false;
    }
    for (pa, pb) in a.parts.iter().zip(b.parts.iter()) {
        match (pa, pb) {
            (SegmentPart::Literal(la), SegmentPart::Literal(lb)) => {
                if la != lb {
                    return false;
                }
            }
            (
                SegmentPart::Param {
                    name: _na,
                    regex: ra,
                },
                SegmentPart::Param {
                    name: _nb,
                    regex: rb,
                },
            ) => match (ra, rb) {
                (None, None) => {}
                (None, Some(_)) | (Some(_), None) => {}
                (Some(x), Some(y)) => {
                    if x.as_str() != y.as_str() {
                        return false;
                    }
                }
            },
            _ => {
                return false;
            }
        }
    }
    true
}

pub fn pattern_is_pure_static(p: &SegmentPattern, key_seg: &str) -> bool {
    if p.parts.len() != 1 {
        return false;
    }
    match &p.parts[0] {
        SegmentPart::Literal(l) => l == key_seg,
        _ => false,
    }
}

pub fn match_segment(
    seg: &str,
    seg_l: &str,
    pat: &SegmentPattern,
) -> Option<Vec<(String, (usize, usize))>> {
    let mut i = 0usize;
    let mut i_l = 0usize;
    let bytes = seg.as_bytes();
    let _bytes_l = seg_l.as_bytes();
    let mut out: Vec<(String, (usize, usize))> = Vec::new();
    let mut idx = 0usize;
    while idx < pat.parts.len() {
        match &pat.parts[idx] {
            SegmentPart::Literal(lit) => {
                if i_l + lit.len() > seg_l.len() {
                    return None;
                }
                if &seg_l[i_l..i_l + lit.len()] != lit.as_str() {
                    return None;
                }
                i += lit.len();
                i_l += lit.len();
            }
            SegmentPart::Param { name, regex } => {
                let mut next_lit: Option<&str> = None;
                if idx + 1 < pat.parts.len()
                    && let SegmentPart::Literal(l) = &pat.parts[idx + 1]
                {
                    next_lit = Some(l.as_str());
                }
                let mut end = bytes.len();
                if let Some(nl_str) = next_lit {
                    let nl = nl_str.len();
                    let mut j_l = i_l;
                    let mut found: Option<usize> = None;
                    while j_l + nl <= seg_l.len() {
                        if &seg_l[j_l..j_l + nl] == nl_str {
                            found = Some(j_l);
                            break;
                        }
                        j_l += 1;
                    }
                    if let Some(stop_l) = found {
                        end = i + (stop_l - i_l);
                    } else {
                        return None;
                    }
                }
                if end < i {
                    return None;
                }
                let slice = &seg[i..end];
                if let Some(re) = regex.as_ref()
                    && !re.is_match(slice)
                {
                    return None;
                }
                out.push((name.clone(), (i, end - i)));
                i = end;
                i_l = end;
            }
        }
        idx += 1;
    }
    if i == seg.len() { Some(out) } else { None }
}
