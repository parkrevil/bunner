/// Error codes returned by route insertion.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InsertError {
    /// An incompatible route exists at the same location.
    Conflict = 1,
    /// User-supplied regex was blocked by safety policy.
    UnsafeRegex = 2,
    /// Malformed pattern syntax.
    Syntax = 3,
    /// `*` wildcard must be the last segment.
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


