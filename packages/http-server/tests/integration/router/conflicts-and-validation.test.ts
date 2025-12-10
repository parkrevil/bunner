import { describe, it, expect } from 'bun:test';

import { Router } from '../../../src/router/router';

describe('Router :: validation and conflicts', () => {
  it('should throw when registering the same method and path twice', () => {
    const builder = new Router();
    builder.add('GET', '/users', () => 'h1');

    expect(() => builder.add('GET', '/users', () => 'h2')).toThrow(/Route already exists/);
  });

  it('should reject a wildcard when a static child already exists', () => {
    const builder = new Router();
    builder.add('GET', '/files/static', () => 'h1');

    expect(() => builder.add('GET', '/files/*', () => 'h2')).toThrow(
      "Conflict: adding wildcard '*' at 'files' would shadow existing routes",
    );
  });

  it('should reject a wildcard when a param child already exists', () => {
    const builder = new Router();
    builder.add('GET', '/users/:id', () => 'h1');

    expect(() => builder.add('GET', '/users/*', () => 'h2')).toThrow(
      "Conflict: adding wildcard '*' at 'users' would shadow existing routes",
    );
  });

  it('should reject parameters with the same name but different regexes', () => {
    const builder = new Router();
    builder.add('GET', '/orders/:id{[0-9]+}', () => 'h1');

    expect(() => builder.add('GET', '/orders/:id{[a-z]+}', () => 'h2')).toThrow(
      "Conflict: parameter ':id' with different regex already exists at 'orders'",
    );
  });

  it('should reject adding a parameter beneath an existing wildcard', () => {
    const builder = new Router();
    builder.add('GET', '/proxy/*rest', () => 'h1');

    expect(() => builder.add('GET', '/proxy/:id', () => 'h2')).toThrow(
      "Conflict: adding parameter ':id' under existing wildcard at 'proxy'",
    );
  });

  it('should reject registering multiple wildcard names at the same branch', () => {
    const builder = new Router();
    builder.add('GET', '/files/*rest', () => 'h1');

    expect(() => builder.add('GET', '/files/*other', () => 'h2')).toThrow("Conflict: wildcard 'rest' already exists at 'files'");
  });

  it('should reject mixing wildcard segments with multi-parameter routes', () => {
    const builder = new Router();
    builder.add('GET', '/files/*rest', () => 'h1');

    expect(() => builder.add('GET', '/files/:rest+', () => 'h2')).toThrow(
      "Conflict: multi-parameter ':rest+' cannot reuse wildcard 'rest' at 'files'",
    );
  });

  it('should reject adding a wildcard after a multi-parameter route already exists', () => {
    const builder = new Router();
    builder.add('GET', '/files/:rest+', () => 'h1');

    expect(() => builder.add('GET', '/files/*rest', () => 'h2')).toThrow("Conflict: wildcard 'rest' already exists at 'files'");
  });

  it('should allow multiple methods to share the same wildcard path definition', () => {
    const builder = new Router();
    builder.add('GET', '/files/*rest', () => 'h1');

    expect(() => builder.add('POST', '/files/*rest', () => 'h2')).not.toThrow();
  });

  it('should reject duplicate parameter names within the same path', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/teams/:id/members/:id', () => 'h1')).toThrow(
      "Duplicate parameter name ':id' detected in path: /teams/:id/members/:id",
    );
  });

  it('should reject adding a static segment beneath an existing wildcard', () => {
    const builder = new Router();
    builder.add('GET', '/proxy/*rest', () => 'h1');

    expect(() => builder.add('GET', '/proxy/static', () => 'h2')).toThrow(
      "Conflict: adding static segment 'static' under existing wildcard at 'proxy'",
    );
  });

  it('should require every parameter segment to declare a name', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/users/:', () => 'h1')).toThrow("Parameter segment must have a name, eg ':id'");
  });

  it('should enforce closing braces on regex parameters', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/users/:id{[0-9]+', () => 'h1')).toThrow("Parameter regex must close with '}'");
  });

  it('should require multi-segment params to be the last segment', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/files/:rest+/tail', () => 'h1')).toThrow(
      "Multi-segment param ':name+' must be the last segment",
    );
  });

  it('should require zero-or-more params to be the last segment', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/files/:rest*/tail', () => 'h1')).toThrow(
      "Zero-or-more param ':name*' must be the last segment",
    );
  });

  it('should reject combining zero-or-more params with the optional suffix', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/files/:rest*?', () => 'h1')).toThrow(/already allows empty matches/);
  });

  it('should enforce global parameter name uniqueness when strictParamNames is enabled', () => {
    const builder = new Router({ strictParamNames: true });
    builder.add('GET', '/accounts/:id', () => 'h1');

    expect(() => builder.add('GET', '/projects/:id', () => 'h2')).toThrow(/already registered/);
  });

  it('should allow identical paths to reuse names across methods in strict mode', () => {
    const builder = new Router({ strictParamNames: true });
    builder.add('GET', '/accounts/:id', () => 'h1');

    expect(() => builder.add('POST', '/accounts/:id', () => 'h2')).not.toThrow();
  });

  it('should require wildcards to reside on the last segment', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/files/*/tail', () => 'h1')).toThrow("Wildcard '*' must be the last segment");
  });

  it('should reject nested quantifiers that may cause catastrophic backtracking', () => {
    const builder = new Router();

    expect(() => builder.add('GET', '/bad/:slug{(a+)+}', () => 'h1')).toThrow(/Nested unlimited quantifiers/i);
  });

  it('should honor the regex anchor policy when set to error', () => {
    const builder = new Router({ regexAnchorPolicy: 'error' });

    expect(() => builder.add('GET', '/strict/:id{^\\d+$}', () => 'h1')).toThrow(/anchors/i);
  });
});
