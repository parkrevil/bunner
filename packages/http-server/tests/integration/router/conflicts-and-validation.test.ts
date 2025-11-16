import { describe, it, expect } from 'bun:test';

import { HttpMethod } from '../../../src/enums';
import { RadixRouterBuilder } from '../../../src/router/router';

describe('RadixRouter :: validation and conflicts', () => {
  it('should throw when registering the same method and path twice', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/users');

    expect(() => router.add(HttpMethod.Get, '/users')).toThrow('Route already exists for method at path: /users');
  });

  it('should reject a wildcard when a static child already exists', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/files/static');

    expect(() => router.add(HttpMethod.Get, '/files/*')).toThrow(
      "Conflict: adding wildcard '*' at 'files' would shadow existing routes",
    );
  });

  it('should reject a wildcard when a param child already exists', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/users/:id');

    expect(() => router.add(HttpMethod.Get, '/users/*')).toThrow(
      "Conflict: adding wildcard '*' at 'users' would shadow existing routes",
    );
  });

  it('should reject parameters with the same name but different regexes', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/orders/:id{[0-9]+}');

    expect(() => router.add(HttpMethod.Get, '/orders/:id{[a-z]+}')).toThrow(
      "Conflict: parameter ':id' with different regex already exists at 'orders'",
    );
  });

  it('should reject adding a parameter beneath an existing wildcard', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/proxy/*rest');

    expect(() => router.add(HttpMethod.Get, '/proxy/:id')).toThrow(
      "Conflict: adding parameter ':id' under existing wildcard at 'proxy'",
    );
  });

  it('should reject registering multiple wildcard names at the same branch', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/files/*rest');

    expect(() => router.add(HttpMethod.Get, '/files/*other')).toThrow("Conflict: wildcard 'rest' already exists at 'files'");
  });

  it('should reject mixing wildcard segments with multi-parameter routes', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/files/*rest');

    expect(() => router.add(HttpMethod.Get, '/files/:rest+')).toThrow(
      "Conflict: multi-parameter ':rest+' cannot reuse wildcard 'rest' at 'files'",
    );
  });

  it('should reject adding a wildcard after a multi-parameter route already exists', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/files/:rest+');

    expect(() => router.add(HttpMethod.Get, '/files/*rest')).toThrow("Conflict: wildcard 'rest' already exists at 'files'");
  });

  it('should allow multiple methods to share the same wildcard path definition', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/files/*rest');

    expect(() => router.add(HttpMethod.Post, '/files/*rest')).not.toThrow();
  });

  it('should reject duplicate parameter names within the same path', () => {
    const router = new RadixRouterBuilder();

    expect(() => router.add(HttpMethod.Get, '/teams/:id/members/:id')).toThrow(
      "Duplicate parameter name ':id' detected in path: /teams/:id/members/:id",
    );
  });

  it('should reject adding a static segment beneath an existing wildcard', () => {
    const router = new RadixRouterBuilder();
    router.add(HttpMethod.Get, '/proxy/*rest');

    expect(() => router.add(HttpMethod.Get, '/proxy/static')).toThrow(
      "Conflict: adding static segment 'static' under existing wildcard at 'proxy'",
    );
  });

  it('should require every parameter segment to declare a name', () => {
    const router = new RadixRouterBuilder();

    expect(() => router.add(HttpMethod.Get, '/users/:')).toThrow("Parameter segment must have a name, eg ':id'");
  });

  it('should enforce closing braces on regex parameters', () => {
    const router = new RadixRouterBuilder();

    expect(() => router.add(HttpMethod.Get, '/users/:id{[0-9]+')).toThrow("Parameter regex must close with '}'");
  });

  it('should require multi-segment params to be the last segment', () => {
    const router = new RadixRouterBuilder();

    expect(() => router.add(HttpMethod.Get, '/files/:rest+/tail')).toThrow(
      "Multi-segment param ':name+' must be the last segment",
    );
  });

  it('should require wildcards to reside on the last segment', () => {
    const router = new RadixRouterBuilder();

    expect(() => router.add(HttpMethod.Get, '/files/*/tail')).toThrow("Wildcard '*' must be the last segment");
  });

  describe('regex safety timeouts', () => {
    const slowTokenPattern = 'SLOW_TOKEN';
    const routePath = `/slow/:token{${slowTokenPattern}}`;
    const targetSource = `^(?:${slowTokenPattern})$`;

    const buildSlowRouter = (mode: 'warn' | 'error') => {
      const builder = new RadixRouterBuilder({ regexSafety: { mode, maxExecutionMs: 1 } });
      builder.add(HttpMethod.Get, routePath);
      return builder.build();
    };

    it('should warn and continue when mode is set to warn', () => {
      const router = buildSlowRouter('warn');
      const warnings: string[] = [];
      const restoreWarn = interceptConsole('warn', warnings);
      try {
        const result = withPatchedRegexTest(targetSource, () => {
          return router.match(HttpMethod.Get, '/slow/SLOW_TOKEN');
        });
        expect(result).toBeNull();
      } finally {
        restoreWarn();
      }
      expect(warnings.some(message => message.includes('exceeded'))).toBe(true);
    });

    it('should throw when mode is set to error', () => {
      const router = buildSlowRouter('error');
      expect(() =>
        withPatchedRegexTest(targetSource, () => {
          return router.match(HttpMethod.Get, '/slow/SLOW_TOKEN');
        }),
      ).toThrow(/exceeded/i);
    });
  });
});

function withPatchedRegexTest<T>(source: string, run: () => T): T {
  const originalTest = RegExp.prototype.test;
  (RegExp.prototype as unknown as { test: (value: string) => boolean }).test = function (this: RegExp, value: string) {
    if (this.source === source) {
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy loop to exceed regexSafety threshold
      }
    }
    return originalTest.call(this, value);
  };
  try {
    return run();
  } finally {
    (RegExp.prototype as unknown as { test: (value: string) => boolean }).test = originalTest;
  }
}

function interceptConsole(level: 'warn' | 'error', sink: string[]): () => void {
  const original = console[level];
  (console as unknown as Record<typeof level, (...args: unknown[]) => void>)[level] = (...args: unknown[]) => {
    sink.push(args.map(arg => String(arg)).join(' '));
  };
  return () => {
    (console as unknown as Record<typeof level, (...args: unknown[]) => void>)[level] = original;
  };
}
