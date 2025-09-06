export const RustCoreError: Record<number, string> = {
  // HTTP Server
  1: 'HandleIsNull',

  // Router
  // Insert-time
  1001: 'RouteConflictOnDuplicatePath',
  1002: 'RoutePathSyntaxInvalid',
  1003: 'RouteWildcardSegmentNotAtEnd',
  1004: 'RoutePathContainsDisallowedCharacters',
  1005: 'RouteDuplicateParamNameInRoute',
  1006: 'RouterSealedCannotInsert',
  1007: 'RouteParamNameConflictAtSamePosition',
  1008: 'RoutePathEmpty',
  1009: 'RoutePathNotAscii',
  1010: 'RouteParamNameInvalidStart',
  1011: 'RouteParamNameInvalidChar',
  1012: 'RouteSegmentContainsMixedParamAndLiteral',
  1013: 'RouteWildcardAlreadyExistsForMethod',
  // Match-time
  1101: 'MatchNotFound',
  1102: 'MatchPathSyntaxInvalid',
  1103: 'MatchPathContainsDisallowedCharacters',
  1104: 'MatchPathEmpty',
  1105: 'MatchPathNotAscii',
} as const;
