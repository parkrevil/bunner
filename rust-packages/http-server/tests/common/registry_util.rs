use crate::pointer_registry;

pub fn register_and_free_cycle(mut data: Vec<u8>) -> bool {
    let ptr = pointer_registry::register(data);

    let has_before = pointer_registry::has(ptr as *mut u8);

    unsafe { pointer_registry::free(ptr as *mut u8) };

    let has_after = pointer_registry::has(ptr as *mut u8);

    has_before && !has_after
}
