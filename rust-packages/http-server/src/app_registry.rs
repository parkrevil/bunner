use crate::app::App;
use crate::structures::AppOptions;
use crate::types::{AppId, AtomicOf};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::{Mutex, OnceLock};

static NEXT_ID: OnceLock<AtomicId> = OnceLock::new();
static INSTANCE_MAP: OnceLock<Mutex<HashMap<AppId, usize>>> = OnceLock::new();
static NAME_TO_ID: OnceLock<Mutex<HashMap<String, AppId>>> = OnceLock::new();

type AtomicId = <AppId as AtomicOf>::Atomic;

/// Registers an app and associates it with `name`. If an app with the same name
/// already exists, returns the existing AppId without creating a new instance.
pub fn register_app(name: &str, options: AppOptions) -> AppId {
    let name_map = NAME_TO_ID.get_or_init(|| Mutex::new(HashMap::new()));

    // Fast path: if name already exists, return it.
    if let Some(existing) = name_map.lock().unwrap().get(name).copied() {
        return existing;
    }

    // Otherwise allocate a new id and store pointers.
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

    // Create App with this id and store the pointer
    let app = Box::new(App::new(id, options));
    let p = Box::into_raw(app);
    map.lock().unwrap().insert(id, p as usize);
    name_map.lock().unwrap().insert(name.to_string(), id);

    id
}

pub fn unregister_app(id: AppId) -> Option<*mut App> {
    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    let removed = map.lock().unwrap().remove(&id).map(|u| u as *mut App);

    if removed.is_some() {
        // Clean up any name -> id entries that referenced this app id.
        let name_map = NAME_TO_ID.get_or_init(|| Mutex::new(HashMap::new()));
        let mut nm = name_map.lock().unwrap();

        // Collect keys to remove to avoid holding mutable borrow while iterating.
        let keys_to_remove: Vec<String> = nm
            .iter()
            .filter_map(|(k, &v)| if v == id { Some(k.clone()) } else { None })
            .collect();

        for k in keys_to_remove {
            nm.remove(&k);
        }
    }

    removed
}

pub fn find_app(id: AppId) -> Option<*mut App> {
    if id == 0 {
        return None;
    }

    let map = INSTANCE_MAP.get_or_init(|| Mutex::new(HashMap::new()));

    map.lock().unwrap().get(&id).copied().map(|u| u as *mut App)
}
