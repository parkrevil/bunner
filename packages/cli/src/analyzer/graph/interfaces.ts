import type { ClassMetadata } from '../interfaces';
import type { ModuleDefinition, ReExport } from '../parser-models';

export interface ProviderRef {
  token: string;
  metadata?: unknown;
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
  exportedValues?: Record<string, unknown>;
  localValues?: Record<string, unknown>;
  moduleDefinition?: ModuleDefinition;
}

export interface CyclePath {
  path: string[];
  suggestedFix?: string;
}
