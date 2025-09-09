#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum HttpServerError {
    HandleIsNull = 1,
    ServerError = 2,
    InvalidHttpMethod = 3,
    InvalidJsonString = 4,
    InvalidRequestId = 5,
    InvalidUrl = 6,
    InvalidQueryString = 7,
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
