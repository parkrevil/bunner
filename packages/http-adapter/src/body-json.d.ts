import type { JsonValue } from './types';

declare global {
  interface Body {
    json(): Promise<JsonValue>;
  }

  interface Request {
    json(): Promise<JsonValue>;
  }

  interface Response {
    json(): Promise<JsonValue>;
  }
}

export {};
