use std::ffi::CStr;
use std::os::raw::c_char;
use once_cell::sync::OnceCell;
use tracing::{info, error, trace, debug, warn};
use tracing_subscriber::{fmt, EnvFilter};

static LOGGER_INIT: OnceCell<()> = OnceCell::new();

#[unsafe(no_mangle)]
pub extern "C" fn init_logger() {
    LOGGER_INIT.get_or_init(|| {
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("info"));

        let subscriber = fmt()
            .with_env_filter(filter)
            .finish();

            tracing::subscriber::set_global_default(subscriber)
                .expect("Failed to set global logger");

        info!("Bunner Rust Logger initialized.");
    });
}

#[unsafe(no_mangle)]
pub extern "C" fn log_trace(message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for trace log message.");
            return;
        }
        CStr::from_ptr(message)
    };

    if let Ok(str_slice) = rust_str.to_str() {
        trace!("{}", str_slice);
    } else {
        error!("Failed to convert C string to UTF-8 for trace log.");
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn log_debug(message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for debug log message.");
            return;
        }
        CStr::from_ptr(message)
    };

    if let Ok(str_slice) = rust_str.to_str() {
        debug!("{}", str_slice);
    } else {
        error!("Failed to convert C string to UTF-8 for debug log.");
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn log_info(message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for info log message.");
            return;
        }
        CStr::from_ptr(message)
    };

    if let Ok(str_slice) = rust_str.to_str() {
        info!("{}", str_slice);
    } else {
        error!("Failed to convert C string to UTF-8 for info log.");
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn log_warn(message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for warn log message.");
            return;
        }
        CStr::from_ptr(message)
    };

    if let Ok(str_slice) = rust_str.to_str() {
        warn!("{}", str_slice);
    } else {
        error!("Failed to convert C string to UTF-8 for warn log.");
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn log_error(message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for error log message.");
            return;
        }
        CStr::from_ptr(message)
    };

    if let Ok(str_slice) = rust_str.to_str() {
        error!("{}", str_slice);
    } else {
        error!("Failed to convert C string to UTF-8 for error log.");
    }
}