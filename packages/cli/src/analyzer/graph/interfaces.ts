import type { ClassMetadata } from '../interfaces';
import type { ReExport } from '../parser-models';

export interface ProviderRef {
  token: any;
  metadata?: any;
  isExported: boolean;
}

export interface ClassInfo {
  metadata: ClassMetadata;
  filePath: string;
}

export interface FileAnalysis {
  filePath: string;
  classes: ClassInfo[];
  reExports: ReExport[];
  exports: string[];
}

export interface CyclePath {
  path: string[];
  suggestedFix?: string;
}
