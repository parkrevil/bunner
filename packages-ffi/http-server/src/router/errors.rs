#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouterError {
    // Insert-time
    RouteConflictOnDuplicatePath = 1001,
    RoutePathSyntaxInvalid = 1002,
    RouteWildcardSegmentNotAtEnd = 1003,
    RoutePathContainsDisallowedCharacters = 1004,
    RouteDuplicateParamNameInRoute = 1005,
    RouterSealedCannotInsert = 1006,
    RouteParamNameConflictAtSamePosition = 1007,
    RoutePathEmpty = 1008,
    RoutePathNotAscii = 1009,
    RouteParamNameInvalidStart = 1010,
    RouteParamNameInvalidChar = 1011,
    RouteSegmentContainsMixedParamAndLiteral = 1012,
    RouteWildcardAlreadyExistsForMethod = 1013,

    // Match-time
    MatchNotFound = 1014,
    MatchPathSyntaxInvalid = 1015,
    MatchPathContainsDisallowedCharacters = 1016,
    MatchPathEmpty = 1017,
    MatchPathNotAscii = 1018,
}
