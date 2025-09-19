use crate::errors::FfiErrorCode;
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
    pub fn from_u8(n: u8) -> Result<Self, FfiErrorCode> {
        match n {
            0 => Ok(Self::Get),
            1 => Ok(Self::Post),
            2 => Ok(Self::Put),
            3 => Ok(Self::Patch),
            4 => Ok(Self::Delete),
            5 => Ok(Self::Options),
            6 => Ok(Self::Head),
            _ => Err(FfiErrorCode::InvalidHttpMethod),
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
    type Err = FfiErrorCode;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "GET" => Ok(Self::Get),
            "POST" => Ok(Self::Post),
            "PUT" => Ok(Self::Put),
            "DELETE" => Ok(Self::Delete),
            "PATCH" => Ok(Self::Patch),
            "HEAD" => Ok(Self::Head),
            "OPTIONS" => Ok(Self::Options),
            _ => Err(FfiErrorCode::InvalidHttpMethod),
        }
    }
}

#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpStatusCode {
    OK = 200,
    BadRequest = 400,
    NotFound = 404,
    UnsupportedMediaType = 415,
    InternalServerError = 500,
}

impl serde::Serialize for HttpStatusCode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_u16(*self as u16)
    }
}

impl<'de> Deserialize<'de> for HttpStatusCode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = u16::deserialize(deserializer)?;
        match v {
            200 => Ok(HttpStatusCode::OK),
            400 => Ok(HttpStatusCode::BadRequest),
            404 => Ok(HttpStatusCode::NotFound),
            415 => Ok(HttpStatusCode::UnsupportedMediaType),
            500 => Ok(HttpStatusCode::InternalServerError),
            _ => Err(serde::de::Error::custom("InvalidHttpStatusCode")),
        }
    }
}

impl HttpStatusCode {
    #[inline]
    pub fn reason_phrase(self) -> &'static str {
        match self {
            HttpStatusCode::OK => "OK",
            HttpStatusCode::BadRequest => "Bad Request",
            HttpStatusCode::NotFound => "Not Found",
            HttpStatusCode::UnsupportedMediaType => "Unsupported Media Type",
            HttpStatusCode::InternalServerError => "Internal Server Error",
        }
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl<'de> Deserialize<'de> for LogLevel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = u8::deserialize(deserializer)?;

        match v {
            0 => Ok(LogLevel::Trace),
            1 => Ok(LogLevel::Debug),
            2 => Ok(LogLevel::Info),
            3 => Ok(LogLevel::Warn),
            4 => Ok(LogLevel::Error),
            _ => Ok(LogLevel::Error),
        }
    }
}

impl LogLevel {
    /// Returns the string name suitable for `tracing_subscriber::EnvFilter::new`.
    #[inline]
    pub fn as_env_filter(&self) -> &'static str {
        match self {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_env_filter())
    }
}

/// A length-prefixed string, either text or binary.
pub enum LenPrefixedString {
    Text(String),
    Bytes(Vec<u8>),
}
