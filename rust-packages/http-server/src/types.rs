pub type ReadonlyPointer = *const u8;

pub type MutablePointer = *mut u8;

pub type AppId = u32;

pub type RequestKey = u64;

pub type LengthHeaderSize = u32;

pub type HandleRequestCallback = extern "C" fn(RequestKey, u16, MutablePointer);

pub type StaticString = &'static str;

pub type ErrorCode = u16;

pub type WorkerId = u32;

/// Helper trait to map an integer ID type to the corresponding `Atomic` type.
/// This allows other modules to derive the correct atomic type from `AppId`.
pub trait AtomicOf {
    type Atomic;
}

impl AtomicOf for u8 {
    type Atomic = std::sync::atomic::AtomicU8;
}

impl AtomicOf for u16 {
    type Atomic = std::sync::atomic::AtomicU16;
}

impl AtomicOf for u32 {
    type Atomic = std::sync::atomic::AtomicU32;
}

impl AtomicOf for u64 {
    type Atomic = std::sync::atomic::AtomicU64;
}
