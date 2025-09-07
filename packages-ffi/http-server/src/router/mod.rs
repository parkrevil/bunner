pub mod errors;
mod interner;
mod pattern;
mod radix;
pub use crate::router::errors::RouterError;
use crate::r#enum::HttpMethod;

#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
use std::sync::Once;
use std::sync::OnceLock;

static DEBUG_FLAG: OnceLock<bool> = OnceLock::new();
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
static SIMD_LOG_ONCE: Once = Once::new();

#[inline]
pub(crate) fn router_debug_enabled() -> bool {
    *DEBUG_FLAG.get_or_init(|| match std::env::var("BUNNER_ROUTER_DEBUG") {
        Ok(val) => matches!(val.as_str(), "1" | "true" | "TRUE"),
        Err(_) => false,
    })
}

#[inline]
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub(crate) fn log_avx2_once() {
    SIMD_LOG_ONCE.call_once(|| {
        eprintln!("[router] AVX2 enabled");
    });
}

#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
#[inline]
pub(crate) fn log_avx2_once() { /* no-op when AVX2 is not available */
}

#[derive(Debug, Clone)]
pub struct Route {
    pub method: HttpMethod,
    pub path: String,
    pub key: u16,
}

#[derive(Debug, Default)]
pub struct MatchResult {
    pub key: u16,
    pub params: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default)]
pub struct MatchOffsets {
    pub key: u16,
    pub params: Vec<(u32, (usize, usize))>,
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

    pub fn find(&self, method: HttpMethod, path: &str) -> Option<MatchResult> {
        let norm = normalize_path(path);
        self.radix.find_norm(method, &norm)
    }

    pub fn find_offsets(&self, method: HttpMethod, path: &str) -> Option<MatchOffsets> {
        let norm = normalize_path(path);
        self.radix.find_norm(method, norm.as_str()).map(|m| {
            let mut out = MatchOffsets {
                key: m.key,
                params: Vec::with_capacity(m.params.len()),
            };
            for (name, (off, len)) in m.params.into_iter() {
                let id = self.radix.interner.intern(name.as_str());
                out.params.push((id, (off, len)));
            }
            out
        })
    }

    #[doc(hidden)]
    pub fn internal_router(&self) -> &radix::RadixRouter {
        &self.radix
    }
}

pub fn register_route(
    router: &mut Router,
    method: HttpMethod,
    path: &str,
) -> Result<u16, errors::RouterError> {
    router.radix.insert(method, path)
}

pub fn match_route(
    router: &Router,
    method: HttpMethod,
    path: &str,
) -> Option<(u16, Vec<(String, String)>)> {
    let norm = normalize_path(path);

    router.radix.find_norm(method, &norm).map(|m| {
        let mut out = Vec::with_capacity(m.params.len());
        for (name, (start, len)) in m.params.into_iter() {
            let val = &norm[start..start + len];
            out.push((name, val.to_string()));
        }
        (m.key, out)
    })
}

pub fn seal(router: &mut Router) {
    router.radix.seal();
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

pub fn match_route_err(
    router: &Router,
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
    if let Some(m) = router.radix.find_norm(method, &norm) {
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

// fallback helpers removed (radix handles all)

// Builder/Handle split (유지: 벤치/테스트 및 향후 최적화 경로)
#[derive(Debug, Default)]
pub struct RouterBuilder {
    radix: radix::RadixRouter,
}

impl RouterBuilder {
    pub fn new() -> Self {
        Self {
            radix: radix::RadixRouter::new(RouterOptions::default()),
        }
    }

    pub fn with_options(options: RouterOptions) -> Self {
        Self {
            radix: radix::RadixRouter::new(options),
        }
    }

    pub fn add(mut self, method: HttpMethod, path: &str) -> Self {
        let _ = self.radix.insert(method, path);
        self
    }

    pub fn seal(mut self) -> Self {
        self.radix.seal();
        self
    }

    pub fn build(self) -> Router {
        Router { radix: self.radix }
    }
}

pub type RouterHandle = Router;
