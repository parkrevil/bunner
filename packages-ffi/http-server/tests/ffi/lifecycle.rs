use bunner_http_server as srv;
use std::ffi::{CStr, c_char, CString};
use std::sync::{Mutex, OnceLock, mpsc};

#[allow(dead_code)]
pub static GLOBAL_TX: OnceLock<Mutex<Option<mpsc::Sender<String>>>> = OnceLock::new();

#[allow(dead_code)]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn global_callback(
    _req_id_ptr: *const c_char,
    _route_key: u16,
    res_ptr: *mut c_char,
) {
    if res_ptr.is_null() {
        return;
    }
    let res_str = unsafe { CStr::from_ptr(res_ptr).to_str().unwrap().to_owned() };
    let lock = GLOBAL_TX.get_or_init(|| Mutex::new(None));
    if let Some(tx) = lock.lock().unwrap().as_ref() {
        let _ = tx.send(res_str);
    }
    unsafe { srv::free_string(res_ptr) };
}

#[allow(dead_code)]
pub fn with_capture<F>(f: F) -> String
where
    F: FnOnce(extern "C" fn(*const c_char, u16, *mut c_char)),
{
    let (tx, rx) = mpsc::channel::<String>();
    {
        let lock = GLOBAL_TX.get_or_init(|| Mutex::new(None));
        *lock.lock().unwrap() = Some(tx);
    }
    f(global_callback);
    let out = rx.recv().unwrap();
    {
        let lock = GLOBAL_TX.get_or_init(|| Mutex::new(None));
        *lock.lock().unwrap() = None;
    }
    out
}

#[allow(dead_code)]
pub fn to_cstr(s: &str) -> CString {
    CString::new(s).unwrap()
}
use bunner_http_server::errors::HttpServerErrorCode;
use bunner_http_server::structure::HttpServerError;
use bunner_http_server::*;
use std::ptr::null_mut;

#[test]
fn initializes_and_destroys_server_instance() {
    let handle = init();
    assert!(!handle.is_null(), "init() should return a valid handle");
    unsafe { destroy(handle) };
}

#[test]
fn does_not_panic_when_destroying_null_handle() {
    // This test ensures that calling destroy with a null pointer is safe and does not crash.
    unsafe { destroy(null_mut()) };
}

#[test]
fn returns_handle_is_null_error_when_handle_is_null() {
    let out = with_capture(|cb| unsafe {
        let req_id = to_cstr("test_req");
        handle_request(std::ptr::null_mut(), req_id.as_ptr(), std::ptr::null(), cb);
    });
    let res: HttpServerError = serde_json::from_str(&out).unwrap();
    assert_eq!(res.code, HttpServerErrorCode::HandleIsNull.code());
}
