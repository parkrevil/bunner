import { describe, expect, it } from 'bun:test';

import { resolveHttpNamesForDocuments, resolveHttpNamesForHosting } from './adapter-names';
import type { AdapterCollectionLike } from './types';

type FakeGroup = {
  forEach: (cb: (adapter: unknown, name: string) => void) => void;
  get?: (name: string) => unknown;
};

function makeAdapters(names: string[]): AdapterCollectionLike {
  const group: FakeGroup = {
    forEach(cb) {
      for (const name of names) {
        cb({}, name);
      }
    },
    get(name) {
      return names.includes(name) ? {} : undefined;
    },
  };

  return { http: group } as unknown as AdapterCollectionLike;
}

describe('resolveHttpNamesForDocuments', () => {
  it('should return all http adapter names when documentTargets is all', () => {
    const adapters = makeAdapters(['a', 'b']);

    expect(resolveHttpNamesForDocuments(adapters, 'all')).toEqual(['a', 'b']);
  });

  it('should filter targets by protocol=http', () => {
    const adapters = makeAdapters(['a', 'b']);

    expect(
      resolveHttpNamesForDocuments(adapters, [
        { protocol: 'tcp', names: ['x'] },
        { protocol: 'http', names: ['b'] },
      ]),
    ).toEqual(['b']);
  });
});

describe('resolveHttpNamesForHosting', () => {
  it('should return only selected names when httpTargets are valid', () => {
    const adapters = makeAdapters(['a', 'b']);

    expect(resolveHttpNamesForHosting(adapters, ['b'])).toEqual(['b']);
  });

  it('should throw when httpTargets contains a missing name', () => {
    const adapters = makeAdapters(['a']);

    expect(() => resolveHttpNamesForHosting(adapters, ['a', 'missing'])).toThrow();
  });
});
