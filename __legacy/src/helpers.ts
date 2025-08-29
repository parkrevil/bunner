import * as YAML from 'yaml';

export function isObject(val: any): val is object {
  return typeof val === 'object' && val !== null;
}

export function isUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getObjectFromString(val: string): { parsed: Record<string, any>, type: 'json' | 'yaml' } {
  try {
    return { parsed: JSON.parse(val), type: 'json' };
  } catch (e) {
    try {
      return { parsed: YAML.parse(val), type: 'yaml' };
    } catch (e) {
      throw new Error('String is not a valid JSON or YAML');
    }
  }
}
