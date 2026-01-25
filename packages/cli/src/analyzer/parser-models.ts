import type { AnalyzerValueArray, AnalyzerValueRecord, ReExportName } from './types';

export interface ReExport {
  module: string;
  exportAll: boolean;
  names?: ReExportName[] | undefined;
}

export interface ModuleDefinition {
  name?: string | undefined;
  nameDeclared?: boolean | undefined;
  providers: AnalyzerValueArray;
  adapters?: import('./types').AnalyzerValue | undefined;
  imports: Record<string, string>;
}

export interface ParseResult {
  classes: import('./interfaces').ClassMetadata[];
  reExports: ReExport[];
  exports: string[];
  imports?: Record<string, string> | undefined;
  importEntries?: import('./interfaces').ImportEntry[] | undefined;
  exportedValues?: AnalyzerValueRecord | undefined;
  localValues?: AnalyzerValueRecord | undefined;
  moduleDefinition?: ModuleDefinition | undefined;
}
