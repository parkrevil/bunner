use smallvec::SmallVec;

// Reduce type complexity with aliases for readability and clippy friendliness
type ParamOffset = (usize, usize);
type CapturedParam = (String, ParamOffset);
type CaptureList = SmallVec<[CapturedParam; 4]>;

#[derive(Debug, Clone)]
pub enum SegmentPart {
    Literal(String),
    Param { name: String },
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
                (SegmentPart::Param { name: na, .. }, SegmentPart::Param { name: nb, .. }) => {
                    if na != nb {
                        return false;
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
    let mut last_lit_len = 0usize;
    for part in p.parts.iter().rev() {
        if let SegmentPart::Literal(l) = part {
            last_lit_len = l.len();
            break;
        }
    }
    let mut param_count = 0usize;
    for (idx, part) in p.parts.iter().enumerate() {
        match part {
            SegmentPart::Literal(l) => {
                s += if idx == 0 { 600 } else { 120 } + l.len();
            }
            SegmentPart::Param { .. } => {
                param_count += 1;
                s += 8;
            }
        }
    }
    s += last_lit_len.min(32) * 5;
    if param_count > 0 {
        s = s.saturating_sub((param_count - 1) * 6);
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

pub fn pattern_shape_key(p: &SegmentPattern) -> u64 {
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

// pattern_shape_weak_key removed (unused)

pub fn pattern_compatible_policy(a: &SegmentPattern, b: &SegmentPattern) -> bool {
    if a.parts.len() != b.parts.len() {
        return true;
    }
    for (pa, pb) in a.parts.iter().zip(b.parts.iter()) {
        match (pa, pb) {
            (SegmentPart::Literal(_), SegmentPart::Literal(_)) => { /* allowed */ }
            (SegmentPart::Param { name: na, .. }, SegmentPart::Param { name: nb, .. }) => {
                if na != nb {
                    return false;
                }
            }
            _ => { /* literal vs param allowed */ }
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

pub fn match_segment(seg: &str, seg_l: &str, pat: &SegmentPattern) -> Option<CaptureList> {
    let mut i = 0usize;
    let mut i_l = 0usize;
    let bytes = seg.as_bytes();
    let mut out: CaptureList = SmallVec::new();
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
            SegmentPart::Param { name } => {
                let mut next_lit: Option<&str> = None;
                if idx + 1 < pat.parts.len()
                    && let SegmentPart::Literal(l) = &pat.parts[idx + 1]
                {
                    next_lit = Some(l.as_str());
                }
                let mut end = bytes.len();
                if let Some(nl_str) = next_lit {
                    if nl_str.len() == 1 {
                        let target = nl_str.as_bytes()[0];
                        if let Some(pos) = memchr::memchr(target, &seg_l.as_bytes()[i_l..]) {
                            end = i + pos;
                        } else {
                            return None;
                        }
                    } else if let Some(rel) =
                        memchr::memmem::find(&seg_l.as_bytes()[i_l..], nl_str.as_bytes())
                    {
                        end = i + rel;
                    } else {
                        return None;
                    }
                }
                if end < i {
                    return None;
                }
                if i == end {
                    return None;
                }
                out.push((name.clone(), (i, end - i)));
                i = end;
                i_l = end;
            }
        }
        idx += 1;
    }
    if i == seg.len() {
        Some(out)
    } else {
        None
    }
}
