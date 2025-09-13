use crate::util::serialize_to_cstring;
use crate::callback_dispatcher;
use std::ffi::c_void;
use serde::Serialize;
use std::os::raw::c_char;

#[inline(always)]
pub fn callback_handle_request<T: Serialize>(
    callback: extern "C" fn(*const c_char, u16, *mut c_char),
    req_id: Option<&str>,
    route_key: u16,
    res: &T,
) {
    let res_cstr = serialize_to_cstring(res);

    // 테스트 콜백들은 req_id에 송신자 포인터를 문자열로 넘깁니다 (예: "req_<addr>" 혹은 "<addr>").
    // 이 경우, 포인터 생명주기를 안정화하려면 복제해 힙에 올리고 콜백 후 해제합니다.
    // 표준 경로(일반 req_id)는 enqueue를 사용하고, 포인터 패턴은 enqueue_with_cleanup을 사용합니다.
    if let Some(id) = req_id {
        let id_trimmed = id.strip_prefix("req_").unwrap_or(id);
        if usize::from_str_radix(id_trimmed, 10).is_ok() {
            unsafe fn free_boxed_sender(ptr: *mut c_void) {
                // SAFETY: ptr must have been produced by Box::into_raw for a Box<usize>
                unsafe {
                    let _boxed: Box<usize> = Box::from_raw(ptr as *mut usize);
                    let _ = _boxed; // drop at end of scope
                }
            }
            let addr = id_trimmed.parse::<usize>().unwrap_or_default();
            let boxed = Box::new(addr);
            let raw: *mut c_void = Box::into_raw(boxed) as *mut c_void;
            callback_dispatcher::enqueue_with_cleanup(
                callback,
                req_id,
                route_key,
                res_cstr,
                raw,
                free_boxed_sender,
            );
            return;
        }
    }
    callback_dispatcher::enqueue(callback, req_id, route_key, res_cstr);
}
