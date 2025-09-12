#![deny(
    clippy::dbg_macro,
    clippy::todo,
    clippy::unimplemented,
    clippy::panic,
    clippy::print_stdout,
    clippy::print_stderr
)]
use once_cell::sync::OnceCell;
use std::ffi::CStr;
use std::os::raw::c_char;
use tracing::{debug, error, info, trace, warn};
use tracing_subscriber::{fmt, EnvFilter};

static LOGGER_INIT: OnceCell<()> = OnceCell::new();

#[repr(C)]
#[allow(non_camel_case_types)]
pub enum LogLevel {
    trace = 0,
    debug = 1,
    info = 2,
    warn = 3,
    error = 4,
}

#[unsafe(no_mangle)]
pub extern "C" fn init() {
    LOGGER_INIT.get_or_init(|| {
        let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

        let subscriber = fmt().with_env_filter(filter).finish();

        tracing::subscriber::set_global_default(subscriber).expect("Failed to set global logger");

        info!("Bunner Rust Logger initialized.");
    });
}

/// Log a message at the specified level.
///
/// # Safety
/// This function is unsafe because it dereferences a raw pointer `message`.
/// The caller must ensure that `message` points to a valid null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn log(level: LogLevel, message: *const c_char) {
    let rust_str = {
        if message.is_null() {
            error!("Received null pointer for log message.");
            return;
        }
        unsafe { CStr::from_ptr(message) }
    };

    if let Ok(str_slice) = rust_str.to_str() {
        match level {
            LogLevel::trace => trace!("{}", str_slice),
            LogLevel::debug => debug!("{}", str_slice),
            LogLevel::info => info!("{}", str_slice),
            LogLevel::warn => warn!("{}", str_slice),
            LogLevel::error => error!("{}", str_slice),
        }
    } else {
        error!("Failed to convert C string to UTF-8.");
    }
}
