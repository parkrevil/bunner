#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HttpMethod {
    Get = 0,
    Post = 1,
    Put = 2,
    Patch = 3,
    Delete = 4,
    Options = 5,
    Head = 6,
    Trace,
    Connect,
}

impl HttpMethod {
    #[inline(always)]
    pub fn from_u8(n: u8) -> Option<Self> {
        match n {
            0 => Some(Self::Get),
            1 => Some(Self::Post),
            2 => Some(Self::Put),
            3 => Some(Self::Patch),
            4 => Some(Self::Delete),
            5 => Some(Self::Options),
            6 => Some(Self::Head),
            _ => None,
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParseHttpMethodError;

impl std::str::FromStr for HttpMethod {
    type Err = ParseHttpMethodError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "GET" => Ok(Self::Get),
            "POST" => Ok(Self::Post),
            "PUT" => Ok(Self::Put),
            "DELETE" => Ok(Self::Delete),
            "PATCH" => Ok(Self::Patch),
            "HEAD" => Ok(Self::Head),
            "OPTIONS" => Ok(Self::Options),
            "TRACE" => Ok(Self::Trace),
            "CONNECT" => Ok(Self::Connect),
            _ => Err(ParseHttpMethodError),
        }
    }
}

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpStatusCode {
    OK = 200,
    BadRequest = 400,
    NotFound = 404,
    InternalServerError = 500,
}
