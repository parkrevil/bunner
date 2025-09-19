use crate::app::App;
use crate::types::{AppId, AtomicOf};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::{Mutex, OnceLock};

static NEXT_ID: OnceLock<AtomicId> = OnceLock::new();
static INSTANCE_MAP: OnceLock<Mutex<HashMap<AppId, usize>>> = OnceLock::new();

type AtomicId = <AppId as AtomicOf>::Atomic;

pub fn register_app(b: Box<App>) -> AppId {
    let p = Box::into_raw(b);
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));
    let counter = NEXT_ID.get_or_init(|| AtomicId::new(1));

    // Use fetch_update to avoid ever returning 0 (0 is treated as invalid)
    let prev = counter
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |cur| {
            let next = cur.wrapping_add(1);
            Some(if next == 0 { 1 } else { next })
        })
        .expect("Atomic fetch_update should succeed");

    let id: AppId = prev as AppId;

    map.lock().unwrap().insert(id, p as usize);

    id
}

pub fn unregister_app(id: AppId) -> Option<*mut App> {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    map.lock().unwrap().remove(&id).map(|u| u as *mut App)
}

pub fn find_app(id: AppId) -> Option<*mut App> {
    if id == 0 {
        return None;
    }

    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    map.lock().unwrap().get(&id).copied().map(|u| u as *mut App)
}
