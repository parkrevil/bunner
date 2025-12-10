import type { EncodedSlashBehavior } from '../types';

export function decodeURIComponentSafe(value: string, behavior: EncodedSlashBehavior | undefined, failFast: boolean): string {
  if (value.indexOf('%') === -1) {
    return value;
  }

  const target = value;

  if (behavior === 'reject') {
    // Check for encoded slashes (%2F or %2f)
    if (/%(2F|2f)/.test(value)) {
      throw new Error('Encoded slashes are forbidden');
    }
  } else if (behavior === 'preserve') {
    return value;
  }

  try {
    return decodeURIComponent(target);
  } catch (e) {
    if (failFast) {
      throw e;
    }
    return value;
  }
}
