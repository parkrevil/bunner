import type { HttpMethodValue } from '../types';

export const RustHttpMethod: Record<HttpMethodValue, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
  OPTIONS: 5,
  HEAD: 6,
} as const;
