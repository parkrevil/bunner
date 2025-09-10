use bunner_http_server as srv;
use std::ffi::{c_char, CStr};
use std::sync::{mpsc, Mutex, OnceLock};

#[allow(dead_code)]
pub static GLOBAL_TX: OnceLock<Mutex<Option<mpsc::Sender<String>>>> = OnceLock::new();

#[allow(dead_code)]
pub extern "C" fn global_callback(_req_id_ptr: *const c_char, _route_key: u16, res_ptr: *mut c_char) {
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
pub fn make_req_id(tx: &mpsc::Sender<String>) -> String {
    (tx as *const _ as usize).to_string()
}
