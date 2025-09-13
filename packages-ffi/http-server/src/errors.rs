#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum HttpServerErrorCode {
    HandleIsNull = 1,
    InvalidHttpMethod,
    InvalidRequestId,
    RouteNotSealed,
    RouterSealedCannotInsert,
    QueueFull,
    InvalidPayload,
    InvalidRoutes,
}

impl HttpServerErrorCode {
    pub fn code(self) -> u16 {
        self as u16
    }
}

impl From<HttpServerErrorCode> for u16 {
    fn from(error: HttpServerErrorCode) -> u16 {
        error as u16
    }
}

impl HttpServerErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            HttpServerErrorCode::HandleIsNull => "HandleIsNull",
            HttpServerErrorCode::InvalidHttpMethod => "InvalidHttpMethod",
            HttpServerErrorCode::InvalidRequestId => "InvalidRequestId",
            HttpServerErrorCode::RouteNotSealed => "RouteNotSealed",
            HttpServerErrorCode::RouterSealedCannotInsert => "RouterSealedCannotInsert",
            HttpServerErrorCode::QueueFull => "QueueFull",
            HttpServerErrorCode::InvalidPayload => "InvalidPayload",
            HttpServerErrorCode::InvalidRoutes => "InvalidRoutes",
        }
    }
}

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InternalErrorCode {
    InvalidCString,
    InvalidJsonValue,
    InvalidJsonString,
}
