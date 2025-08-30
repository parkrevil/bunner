use std::ffi::CString;
use std::os::raw::c_char;
use libloading::{Library, Symbol};

#[test]
fn test_logger_ffi() {
    #[cfg(target_os = "linux")]
    let lib_name = "libbunner_core_logger.so";
    #[cfg(target_os = "macos")]
    let lib_name = "libbunner_core_logger.dylib";
    #[cfg(target_os = "windows")]
    let lib_name = "bunner_core_logger.dll";

    let lib = unsafe {
        Library::new(format!("../../../target/release/{}", lib_name))
            .expect(&format!("Failed to load library: {}", lib_name))
    };

    let init_logger: Symbol<extern "C" fn()> = unsafe {
        lib.get(b"init_logger\0")
            .expect("Could not find init_logger symbol")
    };
    init_logger();

    let log_trace: Symbol<unsafe extern "C" fn(*const c_char)> = unsafe {
        lib.get(b"log_trace\0")
            .expect("Could not find log_trace symbol")
    };
    let trace_message = CString::new("This is a trace message from FFI test.").expect("CString::new failed");
    unsafe { log_trace(trace_message.as_ptr()) };

    let log_debug: Symbol<unsafe extern "C" fn(*const c_char)> = unsafe {
        lib.get(b"log_debug\0")
            .expect("Could not find log_debug symbol")
    };
    let debug_message = CString::new("This is a debug message from FFI test.").expect("CString::new failed");
    unsafe { log_debug(debug_message.as_ptr()) };

    let log_info: Symbol<unsafe extern "C" fn(*const c_char)> = unsafe {
        lib.get(b"log_info\0")
            .expect("Could not find log_info symbol")
    };
    let info_message = CString::new("This is an info message from FFI test.").expect("CString::new failed");
    unsafe { log_info(info_message.as_ptr()) };

    let log_warn: Symbol<unsafe extern "C" fn(*const c_char)> = unsafe {
        lib.get(b"log_warn\0")
            .expect("Could not find log_warn symbol")
    };
    let warn_message = CString::new("This is a warn message from FFI test.").expect("CString::new failed");
    unsafe { log_warn(warn_message.as_ptr()) };

    let log_error: Symbol<unsafe extern "C" fn(*const c_char)> = unsafe {
        lib.get(b"log_error\0")
            .expect("Could not find log_error symbol")
    };
    let error_message = CString::new("This is an error message from FFI test.").expect("CString::new failed");
    unsafe { log_error(error_message.as_ptr()) };

    init_logger();
}
