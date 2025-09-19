use crate::types::{ErrorCode, StaticString};

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum FfiErrorCode {
    AppNotFound = 1,
    InvalidHttpMethod,
    QueueFull,
    InvalidArgument,
}

impl FfiErrorCode {
    pub fn code(self) -> ErrorCode {
        self as ErrorCode
    }

    pub fn name(self) -> StaticString {
        match self {
            FfiErrorCode::AppNotFound => "AppNotFound",
            FfiErrorCode::InvalidHttpMethod => "InvalidHttpMethod",
            FfiErrorCode::QueueFull => "QueueFull",
            FfiErrorCode::InvalidArgument => "InvalidArgument",
        }
    }
}
