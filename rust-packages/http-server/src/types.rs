pub type AppId = u64;

pub type RequestKey = u64;

pub type LengthHeaderSize = u32;

pub type HandleRequestCallback = extern "C" fn(RequestKey, u16, *mut u8);

pub type ErrorString = &'static str;