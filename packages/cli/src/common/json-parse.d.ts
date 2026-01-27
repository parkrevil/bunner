import type { JsonValue } from './interfaces';

declare global {
  interface JSON {
    parse(text: string): JsonValue;
    parse(text: string, reviver: (this: JSON, key: string, value: JsonValue) => JsonValue): JsonValue;
  }
}

export {};
