export type FileIndexEntry = {
  filePath: string;
  mtimeMs: number;
  size: number;
  contentHash: string;
  updatedAt: number;
};

export interface FileIndexRepository {
  getFile(input: { projectKey: string; filePath: string }): Promise<FileIndexEntry | null>;
  upsertFile(input: {
    projectKey: string;
    filePath: string;
    mtimeMs: number;
    size: number;
    contentHash: string;
  }): Promise<void>;
  deleteFile(input: { projectKey: string; filePath: string }): Promise<void>;
}
