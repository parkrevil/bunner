import type { AdapterGroupLike, ScalarCallable, ScalarInput, ScalarRecord, ScalarRegistryKey } from '../scalar/types';

export function isRecord(value: ScalarInput): value is ScalarRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isObjectLike(value: ScalarInput): value is ScalarRecord | ScalarCallable {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

export function isMap<K extends ScalarRegistryKey, V extends ScalarInput>(
  value: ScalarInput | AdapterGroupLike | Map<K, V> | undefined,
): value is Map<K, V> {
  return value instanceof Map;
}
