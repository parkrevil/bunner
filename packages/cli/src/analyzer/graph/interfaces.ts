import type { ClassMetadata } from '../interfaces';
import type { CreateApplicationCall, DefineModuleCall, ModuleDefinition, ReExport } from '../parser-models';
import type { AnalyzerValue, AnalyzerValueRecord } from '../types';

export interface ProviderRef {
  token: string;
  metadata?: AnalyzerValue | ClassMetadata;
  isExported: boolean;
  scope?: string;
  filePath?: string;
}

export interface FileAnalysis {
  filePath: string;
  classes: ClassMetadata[];
  reExports: ReExport[];
  exports: string[];
  imports?: Record<string, string>;
  importEntries?: import('../interfaces').ImportEntry[];
  exportedValues?: AnalyzerValueRecord;
  localValues?: AnalyzerValueRecord;
  moduleDefinition?: ModuleDefinition;
  createApplicationCalls?: CreateApplicationCall[];
  defineModuleCalls?: DefineModuleCall[];
}

export interface AdapterSpecResolveParams {
  fileMap: Map<string, FileAnalysis>;
  projectRoot: string;
}

export interface CyclePath {
  path: string[];
  suggestedFix?: string;
}
