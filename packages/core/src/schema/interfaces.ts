import type { Class } from '../common';

export interface SchemaProperty {
  /**
   * Rename the property when serializing/deserializing.
   * If not provided, the original property name will be used.
   */
  name?: string;
  type: string;
  transform?: Function | Class;
}

export interface TransformBaseOptions {
  version: string;
  groups: string[];
}

export interface TransformOptions extends TransformBaseOptions {
  toPlainOptions?: Omit<ToPlainOptions, keyof TransformBaseOptions>;
  toInstanceOptions?: Omit<ToInstanceOptions, keyof TransformBaseOptions>;
}

export interface ToInstanceOptions extends TransformBaseOptions {
  excludeUnknownProperties?: boolean;
}

export interface ToPlainOptions extends TransformBaseOptions {
  exposeUnsetFields?: boolean;
}

export interface Transformer {
  toInstance(value: any): any;
  toPlain(value: any): any;
}

export interface Schema {
  id: string;
  properties: Record<string, SchemaProperty>;
}
