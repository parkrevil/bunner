export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

export function hasFunctionProperty<TName extends string>(
  value: unknown,
  name: TName,
): value is Record<TName, (...args: unknown[]) => unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value[name] === 'function';
}
