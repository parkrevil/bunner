#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum RouterError {
    // Insert-time
    RouteConflictOnDuplicatePath = 10001,
    RoutePathSyntaxInvalid,
    RouteWildcardSegmentNotAtEnd,
    RoutePathContainsDisallowedCharacters,
    RouteDuplicateParamNameInRoute,
    RouterSealedCannotInsert,
    RouteParamNameConflictAtSamePosition,
    RoutePathEmpty,
    RoutePathNotAscii,
    RouteParamNameInvalidStart,
    RouteParamNameInvalidChar,
    RouteSegmentContainsMixedParamAndLiteral,
    RouteWildcardAlreadyExistsForMethod,
    MaxRoutesExceeded,
    PatternTooLong,
    // Match-time
    MatchNotFound = 10101,
    MatchPathContainsDisallowedCharacters,
    MatchPathEmpty,
    MatchPathNotAscii,
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
