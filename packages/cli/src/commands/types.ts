import type { ClassMetadata } from '../analyzer';

export interface CollectedClass {
  metadata: ClassMetadata;
  filePath: string;
}

export interface CommandOptions {
  profile?: string;
}
