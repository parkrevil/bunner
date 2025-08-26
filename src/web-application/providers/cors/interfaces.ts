import type { HttpMethodValue } from 'src/web-application';

export interface CorsOptions {
  origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string) => boolean | Promise<boolean>);
  methods?: HttpMethodValue[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}
