#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum HttpServerError {
    HandleIsNull = 1,
    InvalidHttpMethod,
    InvalidJsonString,
    InvalidRequestId,
    RouteNotSealed,
    QueueFull,
    InvalidPayload,
}

impl HttpServerError {
    pub fn code(self) -> u16 {
        self as u16
    }
}

impl From<HttpServerError> for u16 {
    fn from(error: HttpServerError) -> u16 {
        error as u16
    }
}
