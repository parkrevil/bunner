#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum RouterError {
    // Insert-time
    RouteConflictOnDuplicatePath = 10001,
    RoutePathSyntaxInvalid = 10002,
    RouteWildcardSegmentNotAtEnd = 10003,
    RoutePathContainsDisallowedCharacters = 10004,
    RouteDuplicateParamNameInRoute = 10005,
    RouterSealedCannotInsert = 10006,
    RouteParamNameConflictAtSamePosition = 10007,
    RoutePathEmpty = 10008,
    RoutePathNotAscii = 10009,
    RouteParamNameInvalidStart = 10010,
    RouteParamNameInvalidChar = 10011,
    RouteSegmentContainsMixedParamAndLiteral = 10012,
    RouteWildcardAlreadyExistsForMethod = 10013,
    MaxRoutesExceeded = 10014,
    PatternTooLong = 10015,
    // Match-time
    MatchNotFound = 10101,
    MatchPathContainsDisallowedCharacters = 10102,
    MatchPathEmpty = 10103,
    MatchPathNotAscii = 10104,
}

impl RouterError {
    pub fn code(self) -> u16 {
        self as u16
    }
}

impl From<RouterError> for u16 {
    fn from(error: RouterError) -> u16 {
        error as u16
    }
}
