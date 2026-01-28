import type { AnalyzerValue, AnalyzerValueArray, AnalyzerValueRecord, ReExportName } from './types';

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

export interface CreateApplicationCall {
  callee: string;
  importSource?: string | undefined;
  args: AnalyzerValueArray;
  start?: number | undefined;
  end?: number | undefined;
}

export interface DefineModuleCall {
  callee: string;
  importSource?: string | undefined;
  args: AnalyzerValueArray;
  start?: number | undefined;
  end?: number | undefined;
  localName?: string | undefined;
  exportedName?: string | undefined;
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
  createApplicationCalls?: CreateApplicationCall[] | undefined;
  defineModuleCalls?: DefineModuleCall[] | undefined;
}
