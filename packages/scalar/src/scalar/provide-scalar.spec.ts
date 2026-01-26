import { describe, it, expect } from 'bun:test';

import type { Provider, ProviderToken, ProviderUseFactory, ProviderUseValue } from '@bunner/common';

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

    const optionsProvider = providers.find(provider => isProviderUseValue(provider, ScalarSetupOptionsToken));

    if (!optionsProvider) {
      throw new Error('Expected Scalar setup options provider to be defined.');
    }

    expect(optionsProvider.useValue).toBe(options);

    const configurerProvider = providers.find(provider => isProviderUseFactory(provider, ScalarConfigurer));

    if (!configurerProvider) {
      throw new Error('Expected Scalar configurer provider to be defined.');
    }

    expect(configurerProvider.useFactory).toBeDefined();
    expect(configurerProvider.inject).toEqual([ScalarSetupOptionsToken]);

    const factory = configurerProvider.useFactory;
    const configurer = factory(options);

    expect(configurer).toBeInstanceOf(ScalarConfigurer);
  });
});

function isProviderUseValue(provider: Provider, token: ProviderToken): provider is ProviderUseValue {
  return typeof provider === 'object' && provider !== null && 'provide' in provider && 'useValue' in provider &&
    provider.provide === token;
}

function isProviderUseFactory(provider: Provider, token: ProviderToken): provider is ProviderUseFactory {
  return typeof provider === 'object' && provider !== null && 'provide' in provider && 'useFactory' in provider &&
    provider.provide === token;
}
