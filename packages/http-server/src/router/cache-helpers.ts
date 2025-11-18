import type { RouteParams } from './types';

export function hydrateParams(entries?: Array<[string, string | undefined]>): RouteParams {
  if (!entries || !entries.length) {
    return Object.create(null);
  }
  const bag = Object.create(null) as RouteParams;
  for (let i = 0; i < entries.length; i++) {
    const pair = entries[i]!;
    bag[pair[0]] = pair[1];
  }
  return bag;
}
