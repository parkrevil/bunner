#[repr(u16)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum RouterErrorCode {
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
    RouterNotSealed,
}

impl RouterErrorCode {
    pub fn code(self) -> u16 {
        self as u16
    }
}

impl From<RouterErrorCode> for u16 {
    fn from(error: RouterErrorCode) -> u16 {
        error as u16
    }
}

impl RouterErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            RouterErrorCode::RouteConflictOnDuplicatePath => "RouteConflictOnDuplicatePath",
            RouterErrorCode::RoutePathSyntaxInvalid => "RoutePathSyntaxInvalid",
            RouterErrorCode::RouteWildcardSegmentNotAtEnd => "RouteWildcardSegmentNotAtEnd",
            RouterErrorCode::RoutePathContainsDisallowedCharacters => {
                "RoutePathContainsDisallowedCharacters"
            }
            RouterErrorCode::RouteDuplicateParamNameInRoute => "RouteDuplicateParamNameInRoute",
            RouterErrorCode::RouterSealedCannotInsert => "RouterSealedCannotInsert",
            RouterErrorCode::RouteParamNameConflictAtSamePosition => {
                "RouteParamNameConflictAtSamePosition"
            }
            RouterErrorCode::RoutePathEmpty => "RoutePathEmpty",
            RouterErrorCode::RoutePathNotAscii => "RoutePathNotAscii",
            RouterErrorCode::RouteParamNameInvalidStart => "RouteParamNameInvalidStart",
            RouterErrorCode::RouteParamNameInvalidChar => "RouteParamNameInvalidChar",
            RouterErrorCode::RouteSegmentContainsMixedParamAndLiteral => {
                "RouteSegmentContainsMixedParamAndLiteral"
            }
            RouterErrorCode::RouteWildcardAlreadyExistsForMethod => {
                "RouteWildcardAlreadyExistsForMethod"
            }
            RouterErrorCode::MaxRoutesExceeded => "MaxRoutesExceeded",
            RouterErrorCode::PatternTooLong => "PatternTooLong",
            RouterErrorCode::MatchNotFound => "MatchNotFound",
            RouterErrorCode::MatchPathContainsDisallowedCharacters => {
                "MatchPathContainsDisallowedCharacters"
            }
            RouterErrorCode::MatchPathEmpty => "MatchPathEmpty",
            RouterErrorCode::MatchPathNotAscii => "MatchPathNotAscii",
        }
    }
}
