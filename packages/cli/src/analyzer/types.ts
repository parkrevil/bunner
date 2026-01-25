import type { Program } from 'oxc-parser';

import type { DecoratorMetadata } from './interfaces';

export type AnalyzerPrimitive = string | number | boolean | null | undefined;

export interface AnalyzerValueRecord {
  [key: string]: AnalyzerValue;
}

export type AnalyzerValueArray = ReadonlyArray<AnalyzerValue>;

export type AnalyzerValue = AnalyzerPrimitive | AnalyzerValueArray | AnalyzerValueRecord | Program;

export interface NodeRecord extends AnalyzerValueRecord {
  readonly type: string;
  readonly start?: number;
  readonly end?: number;
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

export interface DecoratorArguments {
  arguments: readonly AnalyzerValue[];
}

export interface ReExportName {
  local: string;
  exported: string;
}
