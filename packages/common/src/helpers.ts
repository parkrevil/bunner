import type { ProviderToken } from './interfaces';

function inject<T>(_token: ProviderToken): string {
  return 'abc';
}

export {
  inject,
};