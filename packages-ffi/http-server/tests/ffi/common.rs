use crossbeam_channel as mpsc;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::ffi::{c_char, CStr, CString};
use std::sync::Mutex;

lazy_static! {
    static ref SENDER_MAP: Mutex<HashMap<String, mpsc::Sender<String>>> =
        Mutex::new(HashMap::new());
}

pub fn make_req_id(tx: &mpsc::Sender<String>) -> String {
    let req_id = (&*tx as *const _ as usize).to_string();
    SENDER_MAP.lock().unwrap().insert(req_id.clone(), tx.clone());
    req_id
}

pub fn to_cstr(s: &str) -> CString {
    CString::new(s).unwrap()
}

// This function captures output for a given request ID.
pub fn with_capture<F>(f: F) -> String
where
    F: FnOnce(*const c_char, *const c_char),
{
    let (tx, rx) = mpsc::unbounded::<String>();
    let req_id = make_req_id(&tx);
    let req_id_cstr = to_cstr(&req_id);
    f(req_id_cstr.as_ptr(), std::ptr::null());
    rx.recv_timeout(std::time::Duration::from_secs(5))
        .unwrap_or_else(|_| panic!("Timeout waiting for response in with_capture"))
}

// This function captures output when the request ID is null.
pub fn with_capture_null_req_id<F>(f: F) -> String
where
    F: FnOnce(unsafe extern "C" fn(*const c_char, u16, *mut c_char), *const c_char),
{
    let (tx, rx) = mpsc::unbounded::<String>();
    // A "null" request ID for the sender map.
    let req_id = "null_req_id_capture";
    SENDER_MAP.lock().unwrap().insert(req_id.to_string(), tx);
    let req_id_cstr = to_cstr(req_id);

    // Use test_callback as it has the same signature and logic as the old global_callback
    f(test_callback, req_id_cstr.as_ptr());

    let result = rx.recv_timeout(std::time::Duration::from_secs(5))
        .unwrap_or_else(|_| panic!("Timeout waiting for response in with_capture_null_req_id"));
    SENDER_MAP.lock().unwrap().remove(req_id);
    result
}

// The primary callback for tests.
#[unsafe(no_mangle)]
pub extern "C" fn test_callback(req_id_ptr: *const c_char, _route_key: u16, res_ptr: *mut c_char) {
    callback_logic(req_id_ptr, res_ptr);
}

// The logic is shared between test_callback and the conditionally compiled global_callback.
fn callback_logic(req_id_ptr: *const c_char, res_ptr: *mut c_char) {
    if req_id_ptr.is_null() {
        eprintln!("req_id_ptr is null");
        return;
    }
    let req_id = unsafe { CStr::from_ptr(req_id_ptr).to_str().unwrap_or("") };
    if res_ptr.is_null() {
        eprintln!("res_ptr is null for req_id: {}", req_id);
        return;
    }
    let res = unsafe { CStr::from_ptr(res_ptr).to_str().unwrap_or("") };

    if let Some(tx) = SENDER_MAP.lock().unwrap().get(req_id) {
        if let Err(e) = tx.try_send(res.to_string()) {
            eprintln!("Error sending to channel for req_id {}: {}", req_id, e);
        }
    } else {
        // For with_capture_null_req_id, we might use a specific ID.
        if let Some(tx) = SENDER_MAP.lock().unwrap().get("null_req_id_capture") {
             if let Err(e) = tx.try_send(res.to_string()) {
                eprintln!("Error sending to null_req_id_capture channel: {}", e);
            }
        } else {
            eprintln!("No sender found for req_id: {}", req_id);
        }
    }
}

// Conditionally compile global_callback only when not in a test build.
// This avoids the "symbol already defined" linker error during `make test`.
#[cfg(not(test))]
#[no_mangle]
pub extern "C" fn global_callback(req_id_ptr: *const c_char, _route_key: u16, res_ptr: *mut c_char) {
    callback_logic(req_id_ptr, res_ptr);
}