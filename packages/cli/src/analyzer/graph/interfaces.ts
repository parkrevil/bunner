import type { ClassMetadata } from '../interfaces';
import type { ModuleDefinition, ReExport } from '../parser-models';

export interface ProviderRef {
  token: any;
  metadata?: any;
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
  moduleDefinition?: ModuleDefinition;
}

export interface CyclePath {
  path: string[];
  suggestedFix?: string;
}
