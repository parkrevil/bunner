use dashmap::DashMap;
use dashmap::mapref::entry::Entry;
use regex::Regex;
use regex_syntax::Parser as RegexParser;

use super::errors::InsertError;

pub fn validate_regex_safe(re: &str) -> bool {
    // conservative heuristics to block common catastrophic patterns
    let bads = ["(.+)+", "(.*)+", "(.+){", "(.*){", "+)+", "*)+", "{,}", ".+.*+", ".*.++"]; 
    if bads.iter().any(|b| re.contains(b)) { return false; }
    true
}

pub fn anchor_and_compile(norm_src: &str, cache: &DashMap<String, (Regex, u64)>, capacity: Option<usize>, clock: &std::sync::atomic::AtomicU64) -> Result<Regex, InsertError> {
    if RegexParser::new().parse(norm_src).is_err() { return Err(InsertError::Syntax); }
    match cache.entry(norm_src.to_string()) {
        Entry::Occupied(mut e) => {
            let tick = clock.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let (re, _) = e.get().clone();
            e.insert((re.clone(), tick));
            Ok(re)
        }
        Entry::Vacant(v) => {
            let compiled = Regex::new(norm_src).map_err(|_| InsertError::Syntax)?;
            let tick = clock.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            v.insert((compiled.clone(), tick));
            if let Some(cap) = capacity { if cache.len() > cap { evict_one(cache); } }
            Ok(compiled)
        }
    }
}

fn evict_one(cache: &DashMap<String, (Regex, u64)>) {
    // sampled eviction: scan up to 8 entries and drop the oldest
    let mut oldest_key: Option<String> = None;
    let mut oldest_tick: u64 = u64::MAX;
    for (i, e) in cache.iter().take(8).enumerate() {
        let (_, tick) = e.value();
        if *tick < oldest_tick || i == 0 { oldest_tick = *tick; oldest_key = Some(e.key().to_string()); }
    }
    if let Some(k) = oldest_key { let _ = cache.remove(&k); }
}

pub fn normalize_anchor(re_str: &str) -> String {
    let trimmed = re_str.trim();
    if trimmed.starts_with('^') && trimmed.ends_with('$') {
        trimmed.to_string()
    } else {
        let mut s = String::with_capacity(trimmed.len() + 2);
        s.push('^'); s.push_str(trimmed); s.push('$');
        s
    }
}


