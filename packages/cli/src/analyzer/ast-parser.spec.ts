import { describe, expect, it } from 'bun:test';

import { AstParser } from './ast-parser';

describe('AstParser', () => {
  it('should collect createApplication calls from core imports', () => {
    const source = [
      "import { createApplication as ca } from '@bunner/core';",
      "import * as bunner from '@bunner/core';",
      "import { createApplication } from 'other';",
      "import { AppModule } from './app.module';",
      '',
      'ca(AppModule);',
      'bunner.createApplication(AppModule);',
      'createApplication(AppModule);',
    ].join('\n');

    const parser = new AstParser();
    const result = parser.parse('/app/src/main.ts', source);
    const calls = result.createApplicationCalls ?? [];

    expect(calls.map(call => call.callee)).toEqual(['ca', 'bunner.createApplication']);
    expect(calls.every(call => call.importSource === '@bunner/core')).toBe(true);
  });

  it('should collect inject calls from @bunner/common imports', () => {
    const source = [
      "import { inject } from '@bunner/common';",
      "import * as bunner from '@bunner/common';",
      '',
      'const TokenA = 1;',
      '',
      'inject(TokenA);',
      'bunner.inject(TokenA);',
      'inject(() => TokenA);',
      'inject(function () { return TokenA; });',
    ].join('\n');

    const parser = new AstParser();
    const result = parser.parse('/app/src/main.ts', source);
    const calls = result.injectCalls ?? [];

    expect(calls.map(call => call.callee)).toEqual(['inject', 'bunner.inject', 'inject', 'inject']);
    expect(calls.map(call => call.tokenKind)).toEqual(['token', 'token', 'thunk', 'thunk']);
    expect(calls.every(call => call.importSource === '@bunner/common')).toBe(true);
  });

  it('should mark inject call invalid when argument count is not 1', () => {
    const source = [
      "import { inject } from '@bunner/common';",
      '',
      'const TokenA = 1;',
      '',
      'inject(TokenA, TokenA);',
    ].join('\n');

    const parser = new AstParser();
    const result = parser.parse('/app/src/main.ts', source);
    const calls = result.injectCalls ?? [];

    expect(calls).toHaveLength(1);
    expect(calls[0]?.callee).toBe('inject');
    expect(calls[0]?.tokenKind).toBe('invalid');
    expect(calls[0]?.token).toBeNull();
  });
});