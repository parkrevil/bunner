import type { Program } from 'oxc-parser';

import type { DecoratorMetadata } from './interfaces';

export type AnalyzerPrimitive = string | number | boolean | null | undefined;

export interface AnalyzerValueRecord {
  [key: string]: AnalyzerValue;
}

export type AnalyzerValueArray = ReadonlyArray<AnalyzerValue>;

export type AnalyzerProgram = Program;

export type AnalyzerValue = AnalyzerPrimitive | AnalyzerValueArray | AnalyzerValueRecord | AnalyzerProgram;

export interface NodeRecord extends AnalyzerValueRecord {
  readonly type: string;
  readonly start?: number;
  readonly end?: number;
}

export interface TypeInfo {
  typeName: string;
  typeArgs?: string[];
  isUnion?: boolean;
  unionTypes?: TypeInfo[];
  isArray?: boolean;
  isEnum?: boolean;
  literals?: (string | number | boolean)[];
  items?: TypeInfo;
}

export interface ExtractedParam {
  readonly name: string;
  readonly type: AnalyzerValue;
  readonly typeArgs?: string[] | undefined;
  readonly decorators: DecoratorMetadata[];
}

export interface FactoryDependency extends AnalyzerValueRecord {
  readonly name: string;
  readonly path: string;
  readonly start: number;
  readonly end: number;
}

export interface FactoryInjectCall extends AnalyzerValueRecord {
  readonly start: number;
  readonly end: number;
  readonly tokenKind: 'token' | 'thunk' | 'invalid';
  readonly token: AnalyzerValue | null;
}

export interface DecoratorArguments {
  arguments: readonly AnalyzerValue[];
}

export interface ReExportName {
  local: string;
  exported: string;
}
