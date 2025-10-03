import type { Transformer } from '../interfaces';

export interface FieldOptions {
  name?: string;
  type?: Function | [Function];
  transformer?: Transformer;
}
