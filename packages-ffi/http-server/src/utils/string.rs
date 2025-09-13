use std::{
    ffi::{CStr, CString},
    str::{Utf8Error},
    os::raw::c_char,
};

pub fn cstr_to_str<'a>(value: *const c_char) -> Result<&'a str, Utf8Error> {
    unsafe { CStr::from_ptr(value).to_str() }
}

pub fn free_string(ptr: *mut c_char) {
      if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}
