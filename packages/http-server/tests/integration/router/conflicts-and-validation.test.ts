import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouter } from '../../../src/router/router';

describe('RadixRouter :: validation and conflicts', () => {
  it('should throw when registering the same method and path twice', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/users');

    expect(() => router.add(HttpMethod.Get, '/users')).toThrow('Route already exists for method at path: /users');
  });

  it('should reject a wildcard when a static child already exists', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/files/static');

    expect(() => router.add(HttpMethod.Get, '/files/*')).toThrow(
      "Conflict: adding wildcard '*' at 'files' would shadow existing routes",
    );
  });

  it('should reject a wildcard when a param child already exists', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/users/:id');

    expect(() => router.add(HttpMethod.Get, '/users/*')).toThrow(
      "Conflict: adding wildcard '*' at 'users' would shadow existing routes",
    );
  });

  it('should reject parameters with the same name but different regexes', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/orders/:id{[0-9]+}');

    expect(() => router.add(HttpMethod.Get, '/orders/:id{[a-z]+}')).toThrow(
      "Conflict: parameter ':id' with different regex already exists at 'orders'",
    );
  });

  it('should reject adding a parameter beneath an existing wildcard', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/proxy/*rest');

    expect(() => router.add(HttpMethod.Get, '/proxy/:id')).toThrow(
      "Conflict: adding parameter ':id' under existing wildcard at 'proxy'",
    );
  });

  it('should reject adding a static segment beneath an existing wildcard', () => {
    const router = new RadixRouter();
    router.add(HttpMethod.Get, '/proxy/*rest');

    expect(() => router.add(HttpMethod.Get, '/proxy/static')).toThrow(
      "Conflict: adding static segment 'static' under existing wildcard at 'proxy'",
    );
  });

  it('should require every parameter segment to declare a name', () => {
    const router = new RadixRouter();

    expect(() => router.add(HttpMethod.Get, '/users/:')).toThrow("Parameter segment must have a name, eg ':id'");
  });

  it('should enforce closing braces on regex parameters', () => {
    const router = new RadixRouter();

    expect(() => router.add(HttpMethod.Get, '/users/:id{[0-9]+')).toThrow("Parameter regex must close with '}'");
  });

  it('should require multi-segment params to be the last segment', () => {
    const router = new RadixRouter();

    expect(() => router.add(HttpMethod.Get, '/files/:rest+/tail')).toThrow(
      "Multi-segment param ':name+' must be the last segment",
    );
  });

  it('should require wildcards to reside on the last segment', () => {
    const router = new RadixRouter();

    expect(() => router.add(HttpMethod.Get, '/files/*/tail')).toThrow("Wildcard '*' must be the last segment");
  });
});
