use std::ffi::CStr;
use std::os::raw::{c_char, c_uint, c_ulonglong};

use crate::router::{Router, RouterError};

#[repr(C)]
#[derive(Copy, Clone)]
pub struct RouterPtr(pub *mut Router);

#[repr(C)]
pub struct FindRouteResult {
    pub key: c_ulonglong,
    pub error: u32,
}

// Router FFI - 중첩된 구조체
#[repr(C)]
pub struct RouterFfi {
    pub add: extern "C" fn(RouterPtr, c_uint, *const c_char) -> *mut FindRouteResult,
    pub find: extern "C" fn(RouterPtr, c_uint, *const c_char) -> *mut FindRouteResult,
    pub seal: extern "C" fn(RouterPtr) -> (),
    pub free_result: extern "C" fn(*mut FindRouteResult),
}

static ROUTER_FFI: RouterFfi = RouterFfi {
    add,
    find,
    seal,
    free_result,
};

#[unsafe(no_mangle)]
pub extern "C" fn get_ffi() -> *const RouterFfi {
    &ROUTER_FFI as *const RouterFfi
}

pub(crate) extern "C" fn add(
    handle: RouterPtr,
    method: c_uint,
    path: *const c_char,
) -> *mut FindRouteResult {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path = c_str.to_string_lossy();
    let router_ptr = handle.0;

    if router_ptr.is_null() {
        let res = Box::new(FindRouteResult {
            key: 0,
            error: RouterError::RoutePathEmpty as u32,
        });
        return Box::into_raw(res);
    }

    let router_mut = unsafe { &mut *router_ptr };
    let res = match crate::router::register_route(router_mut, method, &path) {
        Ok(k) => FindRouteResult {
            key: k as c_ulonglong,
            error: 0,
        },
        Err(e) => FindRouteResult {
            key: 0,
            error: e as u32,
        },
    };
    Box::into_raw(Box::new(res))
}

pub(crate) extern "C" fn find(
    handle: RouterPtr,
    method: c_uint,
    path: *const c_char,
) -> *mut FindRouteResult {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path = c_str.to_string_lossy();
    let router_ptr = handle.0;
    if router_ptr.is_null() {
        let res = Box::new(FindRouteResult {
            key: 0,
            error: RouterError::MatchPathEmpty as u32,
        });

        return Box::into_raw(res);
    }

    let router_ref = unsafe { &*router_ptr };
    let res =
        if let Some((route_key, _params)) = crate::router::match_route(router_ref, method, &path) {
            FindRouteResult {
                key: route_key as c_ulonglong,
                error: 0,
            }
        } else {
            FindRouteResult {
                key: 0,
                error: RouterError::MatchNotFound as u32,
            }
        };

    Box::into_raw(Box::new(res))
}

pub(crate) extern "C" fn seal(handle: RouterPtr) {
    let router_ptr = handle.0;
    let router_mut = unsafe { &mut *router_ptr };

    crate::router::seal(router_mut);
}

pub(crate) extern "C" fn free_result(ptr: *mut FindRouteResult) {
    if !ptr.is_null() {
        unsafe {
            let _ = Box::from_raw(ptr);
        }
    }
}
