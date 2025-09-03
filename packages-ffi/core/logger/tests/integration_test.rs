use bunner_core_logger::LogLevel;
use libloading::{Library, Symbol};
use std::ffi::CString;
use std::os::raw::c_char;

#[test]
fn test_logger_ffi() {
    let base_name = "bunner_core_logger";
    let lib_name = if cfg!(target_os = "linux") {
        format!("lib{base_name}.so")
    } else if cfg!(target_os = "macos") {
        format!("lib{base_name}.dylib")
    } else if cfg!(target_os = "windows") {
        format!("{base_name}.dll")
    } else {
        panic!("Unsupported operating system for {base_name}");
    };

    let lib = unsafe {
        Library::new(&lib_name).unwrap_or_else(|_| panic!("Failed to load library: {}", lib_name))
    };

    let init: Symbol<extern "C" fn()> =
        unsafe { lib.get(b"init\0").expect("Could not find init symbol") };
    init();

    let log: Symbol<unsafe extern "C" fn(LogLevel, *const c_char)> =
        unsafe { lib.get(b"log\0").expect("Could not find log symbol") };

    let trace_message =
        CString::new("This is a trace message from FFI test.").expect("CString::new failed");
    unsafe { log(LogLevel::trace, trace_message.as_ptr()) };

    let debug_message =
        CString::new("This is a debug message from FFI test.").expect("CString::new failed");
    unsafe { log(LogLevel::debug, debug_message.as_ptr()) };

    let info_message =
        CString::new("This is an info message from FFI test.").expect("CString::new failed");
    unsafe { log(LogLevel::info, info_message.as_ptr()) };

    let warn_message =
        CString::new("This is a warn message from FFI test.").expect("CString::new failed");
    unsafe { log(LogLevel::warn, warn_message.as_ptr()) };

    let error_message =
        CString::new("This is an error message from FFI test.").expect("CString::new failed");
    unsafe { log(LogLevel::error, error_message.as_ptr()) };
}
