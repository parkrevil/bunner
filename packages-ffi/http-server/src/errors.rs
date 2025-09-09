#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpServerError {
    HandleIsNull = 1,
    ServerError = 2,
    InvalidHttpMethod = 3,
    InvalidJsonString = 4,
}

impl HttpServerError {
    pub fn code(self) -> u16 {
        self as u16
    }
}
