#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InternalErrorCode {
    InvalidJsonValue,
    InvalidJsonString,
}
