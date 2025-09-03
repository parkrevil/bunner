#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InsertError {
    Conflict = 1,
    UnsafeRegex = 2,
    Syntax = 3,
    WildcardPosition = 4,
}

impl core::fmt::Display for InsertError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            InsertError::Conflict => write!(f, "conflict"),
            InsertError::UnsafeRegex => write!(f, "unsafe-regex"),
            InsertError::Syntax => write!(f, "syntax"),
            InsertError::WildcardPosition => write!(f, "wildcard-position"),
        }
    }
}
