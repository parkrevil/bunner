use std::ffi::CString;
use std::os::raw::c_char;
use libloading::{Library, Symbol};
use bunner_core_logger::LogLevel;

#[test]
fn test_logger_ffi() {
    #[cfg(target_os = "linux")]
    let lib_name = "libbunner_core_logger.so";
    #[cfg(target_os = "macos")]
    let lib_name = "libbunner_core_logger.dylib";
    #[cfg(target_os = "windows")]
    let lib_name = "bunner_core_logger.dll";

    // 라이브러리 로드
    let lib = unsafe {
        Library::new(&lib_name)
            .expect(&format!("Failed to load library: {}", lib_name))
    };

    // init_logger 함수 가져오기 및 호출
    let init_logger: Symbol<extern "C" fn()> = unsafe {
        lib.get(b"init_logger\0")
            .expect("Could not find init_logger symbol")
    };
    init_logger();

    let log_message: Symbol<unsafe extern "C" fn(LogLevel, *const c_char)> = unsafe {
        lib.get(b"log_message\0")
            .expect("Could not find log_message symbol")
    };

    let trace_message = CString::new("This is a trace message from FFI test.").expect("CString::new failed");
    unsafe { log_message(LogLevel::trace, trace_message.as_ptr()) };

    let debug_message = CString::new("This is a debug message from FFI test.").expect("CString::new failed");
    unsafe { log_message(LogLevel::debug, debug_message.as_ptr()) };

    let info_message = CString::new("This is an info message from FFI test.").expect("CString::new failed");
    unsafe { log_message(LogLevel::info, info_message.as_ptr()) };

    let warn_message = CString::new("This is a warn message from FFI test.").expect("CString::new failed");
    unsafe { log_message(LogLevel::warn, warn_message.as_ptr()) };

    let error_message = CString::new("This is an error message from FFI test.").expect("CString::new failed");
    unsafe { log_message(LogLevel::error, error_message.as_ptr()) };
}