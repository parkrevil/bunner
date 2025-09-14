use std::os::raw::c_char;

pub type HandleRequestCallback = extern "C" fn(*const c_char, u8, u16, *mut c_char, u32);
