import type { ScalarCallable, ScalarInput, ScalarKey, ScalarRecord, ScalarValue } from '../scalar/types';

export function isRecord(value: ScalarInput): value is ScalarRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isObjectLike(value: ScalarInput): value is ScalarRecord | ScalarCallable {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

export function isMap<K extends ScalarKey, V extends ScalarInput>(value: ScalarInput): value is Map<K, V> {
  return value instanceof Map;
}

export function hasFunctionProperty<TName extends string>(
  value: ScalarInput,
  name: TName,
): value is Record<TName, ScalarCallable> {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value[name] === 'function';
}
