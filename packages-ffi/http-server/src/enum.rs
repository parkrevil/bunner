#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HttpMethod {
    Get = 0,
    Post = 1,
    Put = 2,
    Patch = 3,
    Delete = 4,
    Options = 5,
    Head = 6,
}

impl HttpMethod {
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

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "GET" => Some(Self::Get),
            "POST" => Some(Self::Post),
            "PUT" => Some(Self::Put),
            "PATCH" => Some(Self::Patch),
            "DELETE" => Some(Self::Delete),
            "OPTIONS" => Some(Self::Options),
            "HEAD" => Some(Self::Head),
            _ => None,
        }
    }
}

#[repr(u16)]
pub enum HttpStatusCode {
    OK = 200,
    BadRequest = 400,
    NotFound = 404,
    InternalServerError = 500,
}
