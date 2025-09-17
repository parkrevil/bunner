use crate::http_server::HttpServerId;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

// Store pointers as usize to avoid requiring Send/Sync on HttpServer internals.
static INSTANCE_MAP: OnceLock<Mutex<HashMap<HttpServerId, usize>>> = OnceLock::new();
static NEXT_ID: OnceLock<AtomicU64> = OnceLock::new();

pub fn register(b: Box<crate::http_server::HttpServer>) -> HttpServerId {
    // Take ownership of the boxed HttpServer, convert to raw pointer and store its address.
    let p = Box::into_raw(b);
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    let counter = NEXT_ID.get_or_init(|| AtomicU64::new(1));
    let id = counter.fetch_add(1, Ordering::SeqCst);
    map.lock().unwrap().insert(id, p as usize);
    id
}

pub fn unregister(id: HttpServerId) -> Option<*mut crate::http_server::HttpServer> {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    map.lock()
        .unwrap()
        .remove(&id)
        .map(|u| u as *mut crate::http_server::HttpServer)
}

pub fn lookup(id: HttpServerId) -> Option<*mut crate::http_server::HttpServer> {
    if id == 0 {
        return None;
    }
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    map.lock()
        .unwrap()
        .get(&id)
        .copied()
        .map(|u| u as *mut crate::http_server::HttpServer)
}
