pub mod errors;
mod interner;
mod pattern;
mod radix;
pub use crate::router::errors::RouterError;
use crate::r#enum::HttpMethod;

#[derive(Debug, Default)]
pub struct MatchResult {
    pub key: u16,
    pub params: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default)]
pub struct Router {
    radix: radix::RadixRouter,
}

impl Router {
    pub fn new() -> Self {
        Self::with_options(RouterOptions::default(), None)
    }

    pub fn with_options(options: RouterOptions, _default_key: Option<u64>) -> Self {
        Self {
            radix: radix::RadixRouter::new(options),
        }
    }

    pub fn add(&mut self, method: HttpMethod, path: &str) -> Result<u16, errors::RouterError> {
        self.radix.insert(method, path)
    }

    pub fn find(
        &self,
        method: HttpMethod,
        path: &str,
    ) -> Result<(u16, Vec<(String, String)>), RouterError> {
        if path.is_empty() {
            return Err(RouterError::MatchPathEmpty);
        }

        if !path.is_ascii() {
            return Err(RouterError::MatchPathNotAscii);
        }

        if !path_is_allowed_ascii(path) {
            return Err(RouterError::MatchPathContainsDisallowedCharacters);
        }

        let norm = normalize_path(path);

        if !path_is_allowed_ascii(&norm) {
            return Err(RouterError::MatchPathContainsDisallowedCharacters);
        }

        if let Some(m) = self.radix.find_norm(method, &norm) {
            let mut out = Vec::with_capacity(m.params.len());

            for (name, (start, len)) in m.params.into_iter() {
                let val = &norm[start..start + len];
                out.push((name, val.to_string()));
            }
            Ok((m.key, out))
        } else {
            Err(RouterError::MatchNotFound)
        }
    }

    pub fn seal(&mut self) {
        self.radix.seal();
    }

    #[doc(hidden)]
    pub fn internal_router(&self) -> &radix::RadixRouter {
        &self.radix
    }
}


#[derive(Debug, Clone, Copy)]
pub struct RouterOptions {
    // performance/feature toggles
    pub enable_root_prune: bool,
    pub enable_static_full_map: bool,
    pub automatic_optimization: bool,
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self {
            enable_root_prune: false,
            enable_static_full_map: false,
            automatic_optimization: true,
        }
    }
}

fn normalize_path(path: &str) -> String {
    // Fast path: no trailing slash or single "/" → return as-is clone
    if path.len() <= 1 || path.as_bytes().last().is_none() || path.as_bytes().last() != Some(&b'/')
    {
        return path.to_string();
    }
    // Remove trailing slashes while keeping single root
    let mut end = path.len();
    while end > 1 && path.as_bytes()[end - 1] == b'/' {
        end -= 1;
    }
    if end == path.len() {
        return path.to_string();
    }
    path[..end].to_string()
}

#[inline]
pub(crate) fn path_is_allowed_ascii(path: &str) -> bool {
    // RFC3986-safe subset for path: unreserved + sub-delims + ':' '@' '/' and '.'
    // Exclude '%', '?' and '#', and any control/space
    for &b in path.as_bytes() {
        if b <= 0x20 {
            return false;
        }
        match b {
            b'a'..=b'z'
            | b'A'..=b'Z'
            | b'0'..=b'9'
            | b'-'
            | b'.'
            | b'_'
            | b'~'
            | b'!'
            | b'$'
            | b'&'
            | b'\''
            | b'('
            | b')'
            | b'*'
            | b'+'
            | b','
            | b';'
            | b'='
            | b':'
            | b'@'
            | b'/' => {}
            _ => {
                return false;
            }
        }
    }
    true
}



pub type RouterHandle = Router;
