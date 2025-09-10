use crate::errors::HttpServerError;
use serde::de::{Deserialize, Deserializer};
use serde::Serializer;

#[repr(u8)]
#[derive(Debug, Clone, Copy)]
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
    #[inline(always)]
    pub fn from_u8(n: u8) -> Result<Self, HttpServerError> {
        match n {
            0 => Ok(Self::Get),
            1 => Ok(Self::Post),
            2 => Ok(Self::Put),
            3 => Ok(Self::Patch),
            4 => Ok(Self::Delete),
            5 => Ok(Self::Options),
            6 => Ok(Self::Head),
            _ => Err(HttpServerError::InvalidHttpMethod),
        }
    }
}

impl<'de> Deserialize<'de> for HttpMethod {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = u8::deserialize(deserializer)?;

        match v {
            0 => Ok(HttpMethod::Get),
            1 => Ok(HttpMethod::Post),
            2 => Ok(HttpMethod::Put),
            3 => Ok(HttpMethod::Patch),
            4 => Ok(HttpMethod::Delete),
            5 => Ok(HttpMethod::Options),
            6 => Ok(HttpMethod::Head),
            _ => Err(serde::de::Error::custom("InvalidHttpMethod")),
        }
    }
}

impl serde::Serialize for HttpMethod {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_u8(*self as u8)
    }
}

impl std::str::FromStr for HttpMethod {
    type Err = HttpServerError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "GET" => Ok(Self::Get),
            "POST" => Ok(Self::Post),
            "PUT" => Ok(Self::Put),
            "DELETE" => Ok(Self::Delete),
            "PATCH" => Ok(Self::Patch),
            "HEAD" => Ok(Self::Head),
            "OPTIONS" => Ok(Self::Options),
            _ => Err(HttpServerError::InvalidHttpMethod),
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
