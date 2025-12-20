// Strict Standard Decorators Strategy for Parameters
//
// In Standard Decorators (Stage 3), Parameter Decorators are NOT yet supported in the same way.
// However, since we rely on the Bunner CLI to extract metadata at build time,
// these decorators serve purely as markers in the source code.
//
// At Runtime: They must simply be valid expressions that don't crash when invoked.
// When used as `@Body()`, they are called as a function, returning a decorator.
// That decorator is then called by the JS engine IF experimentalDecorators is on.
// IF experimentalDecorators is OFF (Standard Mode), TypeScript might emit them as calls?
// OR it might elide them if they are invalid?
// Actually, if we use them in a valid syntactic location (e.g. valid call), they execute.
// But valid location for standard decorator is Class, Method, Field, AutoAccessor, Getter, Setter. Not Parameter.
//
// User demands "Strict Standard". Syntax `@Body()` on a parameter is NOT standard JS/TS yet.
// However, user is likely using a customized environment or expects us to shim it.
//
// We will define them as functions that return a no-op function.
// This ensures that IF the runtime tries to execute them (e.g. on a method via mistargeting), they don't crash.

export const Body = () => () => {};
export const Query = () => () => {};
export const Params = () => () => {};
export const Request = () => () => {};
export const Response = () => () => {};
export const Cookie = () => () => {};
export const Ip = () => () => {};
