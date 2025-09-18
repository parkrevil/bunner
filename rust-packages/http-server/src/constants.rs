use crate::types::LengthHeaderSize;

use std::mem;

pub const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const PAYLOAD_ZERO_COPY_THRESHOLD: u32 = 16 * 1024; // 16 KB

pub const LENGTH_HEADER_BYTES: usize = mem::size_of::<LengthHeaderSize>();
