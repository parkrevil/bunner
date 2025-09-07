pub mod errors;
mod interner;
pub mod radix;
mod pattern;

pub use errors::RouterError;
use crate::r#enum::HttpMethod;

#[derive(Debug, Default)]
pub struct RouteMatchResult {
    pub route_key: u16,
    pub parameter_offsets: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default)]
pub struct Router {
    radix_tree: radix::RadixTreeRouter,
}

impl Router {
    pub fn new() -> Self {
        Self::with_configuration(RouterOptions::default(), None)
    }

    pub fn with_configuration(configuration: RouterOptions, _default_route_key: Option<u64>) -> Self {
        Self {
            radix_tree: radix::RadixTreeRouter::new(configuration),
        }
    }

    pub fn add(&mut self, method: HttpMethod, path: &str) -> Result<u16, errors::RouterError> {
        self.radix_tree.insert_route(method, path)
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

        if !is_path_character_allowed(path) {
            return Err(RouterError::MatchPathContainsDisallowedCharacters);
        }

        let normalized_path = normalize_path(path);

        if !is_path_character_allowed(&normalized_path) {
            return Err(RouterError::MatchPathContainsDisallowedCharacters);
        }

        if let Some(match_result) = self.radix_tree.find_normalized_route(method, &normalized_path) {
            let mut parameter_pairs = Vec::with_capacity(match_result.parameter_offsets.len());

            for (parameter_name, (start_offset, length)) in match_result.parameter_offsets.into_iter() {
                let parameter_value = &normalized_path[start_offset..start_offset + length];

                parameter_pairs.push((parameter_name, parameter_value.to_string()));
            }

            Ok((match_result.route_key, parameter_pairs))
        } else {
            Err(RouterError::MatchNotFound)
        }
    }

    pub fn finalize_routes(&mut self) {
        self.radix_tree.finalize_routes();
    }

    #[doc(hidden)]
    pub fn get_internal_radix_router(&self) -> &radix::RadixTreeRouter {
        &self.radix_tree
    }
}


#[derive(Debug, Clone, Copy)]
pub struct RouterOptions {
    pub enable_root_level_pruning: bool,
    pub enable_static_route_full_mapping: bool,
    pub enable_automatic_optimization: bool,
}

impl Default for RouterOptions {
    fn default() -> Self {
        Self {
            enable_root_level_pruning: false,
            enable_static_route_full_mapping: false,
            enable_automatic_optimization: true,
        }
    }
}

fn normalize_path(path: &str) -> String {
    if path.len() <= 1 || path.as_bytes().last().is_none() || path.as_bytes().last() != Some(&b'/')
    {
        return path.to_string();
    }

    let mut end_position = path.len();

    while end_position > 1 && path.as_bytes()[end_position - 1] == b'/' {
        end_position -= 1;
    }

    if end_position == path.len() {
        return path.to_string();
    }

    path[..end_position].to_string()
}

#[inline]
pub(crate) fn is_path_character_allowed(path: &str) -> bool {
    for &byte_value in path.as_bytes() {
        if byte_value <= 0x20 {
            return false;
        }

        match byte_value {
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
