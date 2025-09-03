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

#[inline]
fn fnv1a64(bytes: &[u8]) -> u64 {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET;
    for b in bytes {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

/// Build a canonical shape key for a pattern, ignoring parameter names but
/// distinguishing literals and regex sources. Used to group compatible patterns.
pub fn pattern_shape_key(p: &SegmentPattern) -> u64 {
    let mut acc: u64 = 0;
    for part in p.parts.iter() {
        match part {
            SegmentPart::Literal(l) => {
                acc = acc.wrapping_mul(131).wrapping_add(b'L' as u64);
                acc = acc.wrapping_mul(131).wrapping_add(fnv1a64(l.as_bytes()));
            }
            SegmentPart::Param {
                regex: Some(re), ..
            } => {
                acc = acc.wrapping_mul(131).wrapping_add(b'R' as u64);
                acc = acc
                    .wrapping_mul(131)
                    .wrapping_add(fnv1a64(re.as_str().as_bytes()));
            }
            SegmentPart::Param { regex: None, .. } => {
                acc = acc.wrapping_mul(131).wrapping_add(b'P' as u64);
            }
        }
    }
    acc
}

/// Build a weaker shape key that ignores regex presence and source for params.
pub fn pattern_shape_weak_key(p: &SegmentPattern) -> u64 {
    let mut acc: u64 = 0;
    for part in p.parts.iter() {
        match part {
            SegmentPart::Literal(l) => {
                acc = acc.wrapping_mul(131).wrapping_add(b'L' as u64);
                acc = acc.wrapping_mul(131).wrapping_add(fnv1a64(l.as_bytes()));
            }
            SegmentPart::Param { .. } => {
                acc = acc.wrapping_mul(131).wrapping_add(b'P' as u64);
            }
        }
    }
    acc
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
                    if let Some(rel) = seg_l[i_l..].find(nl_str) {
                        end = i + rel;
                    } else {
                        return None;
                    }
                }
                if end < i {
                    return None;
                }
                let slice = &seg[i..end];
                if let Some(re) = regex.as_ref() {
                    if let Some(ok) = fast_match_known(slice, re.as_str()) {
                        if !ok {
                            return None;
                        }
                    } else if !re.is_match(slice) {
                        return None;
                    }
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

#[inline]
fn fast_match_known(slice: &str, re_src: &str) -> Option<bool> {
    match re_src {
        "\\d+" => return Some(slice.as_bytes().iter().all(|b| b.is_ascii_digit())),
        "v\\d+" => {
            let s = slice.as_bytes();
            if s.first().copied() != Some(b'v') {
                return Some(false);
            }
            return Some(s[1..].iter().all(|b| b.is_ascii_digit()));
        }
        "[a-z0-9-]+" => {
            return Some(
                slice
                    .as_bytes()
                    .iter()
                    .all(|b| matches!(*b, b'0'..=b'9' | b'a'..=b'z' | b'-')),
            );
        }
        _ => {}
    }
    if re_src.starts_with("\\d{") && re_src.ends_with('}') {
        if !slice.as_bytes().iter().all(|b| b.is_ascii_digit()) {
            return Some(false);
        }
        return None;
    }
    if re_src == "\\w+\\.\\w+" {
        let bs = slice.as_bytes();
        if let Some(dot) = bs.iter().position(|&b| b == b'.') {
            if dot == 0 || dot == bs.len() - 1 {
                return Some(false);
            }
            let (a, b) = (&bs[..dot], &bs[dot + 1..]);
            let ok = a
                .iter()
                .all(|c| (*c as char).is_ascii_alphanumeric() || *c == b'_')
                && b.iter()
                    .all(|c| (*c as char).is_ascii_alphanumeric() || *c == b'_');
            return Some(ok);
        } else {
            return Some(false);
        }
    }
    None
}
