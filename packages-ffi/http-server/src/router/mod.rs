//

mod errors;
mod pattern;
mod radix;
mod regex_guard;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Method {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    OPTIONS,
    HEAD,
}

#[derive(Debug, Clone)]
pub struct Route {
    pub method: Method,
    pub path: String,
    pub key: u64,
}

#[derive(Debug, Default)]
pub struct MatchResult {
    pub key: u64,
    // zero-copy friendly: (name, (start, len)) over the original path
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

    pub fn add(&mut self, method: Method, path: &str, key: u64) {
        let _ = self.radix.insert(method, path, key);
    }

    pub fn find(&self, method: Method, path: &str) -> Option<MatchResult> {
        self.radix.find(method, path)
    }
}

fn method_from_u32(m: u32) -> Method {
    match m {
        0 => Method::GET,
        1 => Method::POST,
        2 => Method::PUT,
        3 => Method::PATCH,
        4 => Method::DELETE,
        5 => Method::OPTIONS,
        6 => Method::HEAD,
        _ => Method::GET,
    }
}

pub fn register_route(router: &mut Router, method: u32, path: &str, key: u64) -> bool {
    let method = method_from_u32(method);
    match router.radix.insert(method, path, key) {
        Ok(()) => true,
        Err(errors::InsertError::Conflict) => true, // idempotent/no-op on conflict
        Err(_) => false,
    }
}

pub fn register_route_ex(router: &mut Router, method: u32, path: &str, key: u64) -> u32 {
    let method = method_from_u32(method);
    match router.radix.insert(method, path, key) {
        Ok(()) => 0,
        Err(e) => e as u32,
    }
}

pub fn match_route(
    router: &Router,
    method: u32,
    path: &str,
) -> Option<(u64, Vec<(String, String)>)> {
    let method = method_from_u32(method);
    // Use the same normalized string for matching and slicing to keep offsets consistent.
    let norm = normalize_path(path, &router.radix.options);
    router.find(method, &norm).map(|m| {
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
    pub ignore_trailing_slash: bool,
    pub ignore_duplicate_slashes: bool,
    pub case_sensitive: bool,
    pub allow_unsafe_regex: bool,
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self {
            ignore_trailing_slash: false,
            ignore_duplicate_slashes: false,
            case_sensitive: true,
            allow_unsafe_regex: false,
        }
    }
}

pub use errors::InsertError;

fn normalize_path(path: &str, opts: &RouterOptions) -> String {
    let bytes = path.as_bytes();
    let mut out = String::with_capacity(bytes.len());
    let mut i = 0;
    let mut prev_slash = false;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'/' {
            if !opts.ignore_duplicate_slashes || !prev_slash {
                out.push('/');
            }
            prev_slash = true;
            i += 1;
            continue;
        }
        prev_slash = false;
        out.push(b as char);
        i += 1;
    }
    if opts.ignore_trailing_slash && out.len() > 1 && out.as_bytes()[out.len() - 1] == b'/' {
        let mut end = out.len();
        while end > 1 && out.as_bytes()[end - 1] == b'/' {
            end -= 1;
        }
        out.truncate(end);
    }
    out
}

// fallback helpers removed (radix handles all)

// Builder/Handle split (non-breaking addition)

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
    pub fn add(mut self, method: Method, path: &str, key: u64) -> Self {
        let _ = self.radix.insert(method, path, key);
        self
    }
    pub fn seal(mut self) -> Self {
        self.radix.seal();
        self
    }
    pub fn build(self) -> RouterHandle {
        RouterHandle { radix: self.radix }
    }
}

#[derive(Debug)]
pub struct RouterHandle {
    radix: radix::RadixRouter,
}

impl RouterHandle {
    pub fn find(&self, method: Method, path: &str) -> Option<MatchResult> {
        self.radix.find(method, path)
    }
}
