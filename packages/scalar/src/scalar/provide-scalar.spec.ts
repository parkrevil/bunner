import { describe, it, expect } from 'bun:test';

import type { ScalarSetupOptions } from './interfaces';
import { provideScalar } from './provide-scalar';
import { ScalarConfigurer } from './scalar-configurer';
import { ScalarSetupOptionsToken } from './tokens';

describe('provideScalar', () => {
  it('should return providers for Scalar setup', () => {
    const options: ScalarSetupOptions = {
      documentTargets: 'all',
      httpTargets: ['http-server'],
    };
    const providers = provideScalar(options);

    expect(providers).toHaveLength(2);

    const optionsProvider = providers.find(
      (p: any) => p && typeof p === 'object' && 'provide' in p && p.provide === ScalarSetupOptionsToken,
    ) as any;

    expect(optionsProvider).toBeDefined();
    expect(optionsProvider.useValue).toBe(options);

    const configurerProvider = providers.find(
      (p: any) => p && typeof p === 'object' && 'provide' in p && p.provide === ScalarConfigurer,
    ) as any;

    expect(configurerProvider).toBeDefined();
    expect(configurerProvider.useFactory).toBeDefined();
    expect(configurerProvider.inject).toEqual([ScalarSetupOptionsToken]);

    const factory = configurerProvider.useFactory;
    const configurer = factory(options);

    expect(configurer).toBeInstanceOf(ScalarConfigurer);
  });
});
