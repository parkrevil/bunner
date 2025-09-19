pub type ReadonlyPointer = *const u8;

pub type MutablePointer = *mut u8;

pub type AppId = u64;

pub type RequestKey = u64;

pub type LengthHeaderSize = u32;

pub type HandleRequestCallback = extern "C" fn(RequestKey, u16, MutablePointer);

pub type StaticString = &'static str;

pub type ErrorCode = u16;
