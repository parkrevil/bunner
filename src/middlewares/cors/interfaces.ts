import { HttpMethod } from '../../enums';

export interface CorsOptions {
  origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string) => boolean | Promise<boolean>);
  methods?: HttpMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}
