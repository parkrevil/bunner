use std::ffi::CStr;
use std::os::raw::{c_char, c_uint, c_ulonglong};

use super::{self as router, Router, RouterOptions};

#[repr(C)]
pub struct RouterHandle(pub *mut Router);

#[unsafe(no_mangle)]
pub extern "C" fn create_router() -> RouterHandle {
    let boxed = Box::new(Router::new());
    RouterHandle(Box::into_raw(boxed))
}

#[repr(C)]
pub struct RouterOptionsC {
    pub ignore_trailing_slash: bool,
    pub ignore_duplicate_slashes: bool,
    pub case_sensitive: bool,
    pub allow_unsafe_regex: bool,
}

#[unsafe(no_mangle)]
pub extern "C" fn create_router_with_options(opts: RouterOptionsC) -> RouterHandle {
    let options = RouterOptions {
        ignore_trailing_slash: opts.ignore_trailing_slash,
        ignore_duplicate_slashes: opts.ignore_duplicate_slashes,
        case_sensitive: opts.case_sensitive,
        allow_unsafe_regex: opts.allow_unsafe_regex,
    };
    let boxed = Box::new(Router::with_options(options, None));
    RouterHandle(Box::into_raw(boxed))
}

#[unsafe(no_mangle)]
pub extern "C" fn destroy_router(handle: RouterHandle) {
    if !handle.0.is_null() {
        unsafe { drop(Box::from_raw(handle.0)); }
    }
}

#[repr(C)]
pub struct MatchKV {
    pub key_ptr: *mut c_char,
    pub val_ptr: *mut c_char,
}

#[repr(C)]
pub struct MatchResultC {
    pub route_key: c_ulonglong,
    pub buf_ptr: *mut u8,
    pub buf_len: usize,
    pub offsets_ptr: *mut u32,
    pub offsets_len: usize,
}

#[unsafe(no_mangle)]
pub extern "C" fn register_route(handle: RouterHandle, method: c_uint, path: *const c_char, key: c_ulonglong) -> bool {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path = c_str.to_string_lossy();
    let router_ptr = handle.0;
    if router_ptr.is_null() { return false; }
    let router_mut = unsafe { &mut *router_ptr };
    router::register_route(router_mut, method as u32, &path, key as u64)
}

#[unsafe(no_mangle)]
pub extern "C" fn register_route_ex(handle: RouterHandle, method: c_uint, path: *const c_char, key: c_ulonglong) -> c_uint {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path = c_str.to_string_lossy();
    let router_ptr = handle.0;
    if router_ptr.is_null() { return 255; /* invalid handle */ }
    let router_mut = unsafe { &mut *router_ptr };
    router::register_route_ex(router_mut, method as u32, &path, key as u64)
}

#[unsafe(no_mangle)]
pub extern "C" fn match_route(handle: RouterHandle, method: c_uint, path: *const c_char) -> MatchResultC {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path = c_str.to_string_lossy();
    let router_ptr = handle.0;
    if router_ptr.is_null() {
        return MatchResultC { route_key: 0, buf_ptr: std::ptr::null_mut(), buf_len: 0, offsets_ptr: std::ptr::null_mut(), offsets_len: 0 };
    }
    let router_ref = unsafe { &*router_ptr };
    if let Some((route_key, params)) = router::match_route(router_ref, method as u32, &path) {
        let mut buf: Vec<u8> = Vec::new();
        let mut offsets: Vec<u32> = Vec::with_capacity(params.len() * 2);
        for (k, v) in params.iter() {
            offsets.push(buf.len() as u32);
            buf.extend_from_slice(k.as_bytes());
            buf.push(0);
            offsets.push(buf.len() as u32);
            buf.extend_from_slice(v.as_bytes());
            buf.push(0);
        }
        let mut buf_box = buf.into_boxed_slice();
        let mut off_box = offsets.into_boxed_slice();
        let out = MatchResultC {
            route_key: route_key as c_ulonglong,
            buf_ptr: buf_box.as_mut_ptr(),
            buf_len: buf_box.len(),
            offsets_ptr: off_box.as_mut_ptr(),
            offsets_len: off_box.len(),
        };
        std::mem::forget(buf_box);
        std::mem::forget(off_box);
        return out;
    }
    MatchResultC { route_key: 0, buf_ptr: std::ptr::null_mut(), buf_len: 0, offsets_ptr: std::ptr::null_mut(), offsets_len: 0 }
}

#[unsafe(no_mangle)]
pub extern "C" fn free_match_result(res: MatchResultC) {
    unsafe {
        if !res.buf_ptr.is_null() && res.buf_len > 0 {
            let _ = Vec::from_raw_parts(res.buf_ptr, res.buf_len, res.buf_len);
        }
        if !res.offsets_ptr.is_null() && res.offsets_len > 0 {
            let _ = Vec::from_raw_parts(res.offsets_ptr, res.offsets_len, res.offsets_len);
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn seal_router(handle: RouterHandle) {
    let router_ptr = handle.0;
    if router_ptr.is_null() { return; }
    let router_mut = unsafe { &mut *router_ptr };
    router::seal(router_mut);
}


