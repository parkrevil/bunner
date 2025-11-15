const DIGIT_PATTERNS = new Set(['\\d+', '\\d{1,}', '[0-9]+', '[0-9]{1,}']);
const ALPHA_PATTERNS = new Set(['[a-zA-Z]+', '[A-Za-z]+']);
const ALPHANUM_PATTERNS = new Set(['[A-Za-z0-9_\\-]+', '[A-Za-z0-9_-]+', '\\w+', '\\w{1,}']);

export function buildPatternTester(source: string | undefined, compiled: RegExp): (value: string) => boolean {
  if (!source) {
    return value => compiled.test(value);
  }
  if (DIGIT_PATTERNS.has(source)) {
    return isAllDigits;
  }
  if (ALPHA_PATTERNS.has(source)) {
    return isAlpha;
  }
  if (ALPHANUM_PATTERNS.has(source)) {
    return isAlphaNumericDash;
  }
  if (source === '[^/]+') {
    return value => value.length > 0 && value.indexOf('/') === -1;
  }
  return value => compiled.test(value);
}

function isAllDigits(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
}

function isAlpha(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!upper && !lower) {
      return false;
    }
  }
  return true;
}

function isAlphaNumericDash(value: string): boolean {
  if (!value.length) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (!upper && !lower && !digit && code !== 45 && code !== 95) {
      return false;
    }
  }
  return true;
}
