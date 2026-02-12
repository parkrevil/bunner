import type { Program } from 'oxc-parser';

export type CodeRelationType = 'imports' | 'calls' | 'extends' | 'implements';

export interface CodeRelation {
  type: CodeRelationType;
  srcEntityKey: string;
  dstEntityKey: string;
  metaJson?: string;
}

export interface CodeRelationExtractor {
  name: string;
  extract(ast: Program, filePath: string): CodeRelation[];
}
