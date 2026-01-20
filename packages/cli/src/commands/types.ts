import type { ClassMetadata } from '../analyzer';

export interface CollectedClass {
  metadata: ClassMetadata;
  filePath: string;
}
