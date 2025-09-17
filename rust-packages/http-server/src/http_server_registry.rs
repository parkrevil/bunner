use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, Ordering};

// Store raw pointer addresses as usize to avoid Send/Sync bounds on pointer types.
static INSTANCE_MAP: OnceLock<Mutex<HashMap<u64, usize>>> = OnceLock::new();
static NEXT_ID: OnceLock<AtomicU64> = OnceLock::new();

pub fn register_instance_ptr(p: *mut crate::HttpServer) -> u64 {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    let counter = NEXT_ID.get_or_init(|| AtomicU64::new(1));
    let id = counter.fetch_add(1, Ordering::SeqCst);
    map.lock().unwrap().insert(id, p as usize);
    id
}

pub fn unregister_instance_ptr(id: u64) -> Option<*mut crate::HttpServer> {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    map.lock().unwrap().remove(&id).map(|v| v as *mut crate::HttpServer)
}

pub fn lookup_instance_ptr(id: u64) -> Option<*mut crate::HttpServer> {
    if id == 0 {
        return None;
    }
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    map.lock().unwrap().get(&id).copied().map(|v| v as *mut crate::HttpServer)
}
