#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouterError {
    // Insert-time
    RouteConflictOnDuplicatePath = 1,
    RoutePathSyntaxInvalid = 3,
    RouteWildcardSegmentNotAtEnd = 4,
    RoutePathContainsDisallowedCharacters = 5,
    RouteDuplicateParamNameInRoute = 6,
    RouterSealedCannotInsert = 7,
    RouteParamNameConflictAtSamePosition = 8,
    RoutePathEmpty = 9,
    RoutePathNotAscii = 10,
    RouteParamNameInvalidStart = 11,
    RouteParamNameInvalidChar = 12,
    RouteSegmentContainsMixedParamAndLiteral = 13,
    RouteWildcardAlreadyExistsForMethod = 14,

    // Match-time
    MatchNotFound = 100,
    MatchPathSyntaxInvalid = 101,
    MatchPathContainsDisallowedCharacters = 102,
    MatchPathEmpty = 103,
    MatchPathNotAscii = 104,
}
