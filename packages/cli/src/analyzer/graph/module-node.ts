import type { ClassMetadata } from '../interfaces';

import type { ProviderRef, ClassInfo } from './interfaces';

export class ModuleNode {
  name: string;
  metadata: ClassMetadata;
  filePath: string;
  imports: Set<ModuleNode> = new Set();
  dynamicImports: Set<any> = new Set();
  providers: Map<string, ProviderRef> = new Map();
  exports: Set<string> = new Set();
  controllers: Set<string> = new Set();

  visiting: boolean = false;
  visited: boolean = false;

  constructor(info: ClassInfo) {
    this.name = info.metadata.className;
    this.metadata = info.metadata;
    this.filePath = info.filePath;
  }
}
