use std::ffi::CStr;
use std::os::raw::c_char;
use once_cell::sync::OnceCell;
use tracing::{info, error, trace, debug, warn};
use tracing_subscriber::{fmt, EnvFilter};

static LOGGER_INIT: OnceCell<()> = OnceCell::new();

#[repr(C)]
#[allow(non_camel_case_types)]
pub enum LogLevel {
    trace,
    debug,
    info,
    warn,
    error,
}

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
pub extern "C" fn log_message(level: LogLevel, message: *const c_char) {
    let rust_str = unsafe {
        if message.is_null() {
            error!("Received null pointer for log message.");
            return;
        }
        CStr::from_ptr(message)
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