export function resolveDocFromPath(path: string): { docId: string; isJson: boolean } | null {
  const base = '/api-docs/';

  if (!path.startsWith(base)) {
    return null;
  }

  const suffix = path.slice(base.length);

  if (!suffix) {
    return null;
  }

  if (suffix.endsWith('.json')) {
    return { docId: decodeURIComponent(suffix.slice(0, -5)), isJson: true };
  }

  return { docId: decodeURIComponent(suffix), isJson: false };
}
