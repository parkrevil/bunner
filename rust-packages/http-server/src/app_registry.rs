use crate::types::AppId;
use crate::app::App;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

static INSTANCE_MAP: OnceLock<Mutex<HashMap<AppId, usize>>> = OnceLock::new();
static NEXT_ID: OnceLock<AtomicU64> = OnceLock::new();

pub fn register_app(b: Box<App>) -> AppId {
    let p = Box::into_raw(b);
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    let counter = NEXT_ID.get_or_init(|| AtomicU64::new(1));
    let id = counter.fetch_add(1, Ordering::SeqCst);

    map.lock().unwrap().insert(id, p as usize);

    id
}

pub fn unregister_app(id: AppId) -> Option<*mut App> {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    map.lock()
        .unwrap()
        .remove(&id)
        .map(|u| u as *mut App)
}

pub fn find_app(id: AppId) -> Option<*mut App> {
    if id == 0 {
        return None;
    }

    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    map.lock()
        .unwrap()
        .get(&id)
        .copied()
        .map(|u| u as *mut App)
}
