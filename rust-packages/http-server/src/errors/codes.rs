#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum FfiErrorCode {
    AppNotFound = 1,
    InvalidHttpMethod,
    QueueFull,
    InvalidPayload,
}

impl FfiErrorCode {
    pub fn code(self) -> u16 {
        self as u16
    }

    pub fn as_str(self) -> &'static str {
        match self {
            FfiErrorCode::AppNotFound => "AppNotFound",
            FfiErrorCode::InvalidHttpMethod => "InvalidHttpMethod",
            FfiErrorCode::QueueFull => "QueueFull",
            FfiErrorCode::InvalidPayload => "InvalidPayload",
        }
    }
}
