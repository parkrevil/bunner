use std::os::raw::c_char;

pub type HandleRequestCallback = extern "C" fn(*const c_char, u16, *mut c_char);
