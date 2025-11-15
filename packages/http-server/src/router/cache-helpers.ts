export function hydrateParams(entries?: Array<[string, string]>): Record<string, string> {
  if (!entries || !entries.length) {
    return Object.create(null);
  }
  const bag = Object.create(null) as Record<string, string>;
  for (let i = 0; i < entries.length; i++) {
    const pair = entries[i]!;
    bag[pair[0]] = pair[1];
  }
  return bag;
}
