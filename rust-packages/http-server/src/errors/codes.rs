use crate::types::{ErrorCode, ErrorString};

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum FfiErrorCode {
    AppNotFound = 1,
    InvalidHttpMethod,
    QueueFull,
    InvalidPayload,
}

impl FfiErrorCode {
    pub fn code(self) -> ErrorCode {
        self as ErrorCode
    }

    pub fn name(self) -> ErrorString {
        match self {
            FfiErrorCode::AppNotFound => "AppNotFound",
            FfiErrorCode::InvalidHttpMethod => "InvalidHttpMethod",
            FfiErrorCode::QueueFull => "QueueFull",
            FfiErrorCode::InvalidPayload => "InvalidPayload",
        }
    }
}
