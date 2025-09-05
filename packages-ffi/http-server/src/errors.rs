#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpServerError {
    HandleIsNull = 1,
}
