use std::collections::HashMap;

use cookie::Cookie;

/// Parses a cookie header according to RFC 6265 using the `cookie` crate.
pub fn parse_cookie_header(cookie_header: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();

    for cookie in Cookie::split_parse(cookie_header).flatten() {
        map.insert(cookie.name().to_string(), cookie.value().to_string());
    }

    map
}
