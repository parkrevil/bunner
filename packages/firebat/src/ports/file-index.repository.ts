export interface FileIndexEntry {
  readonly filePath: string;
  readonly mtimeMs: number;
  readonly size: number;
  readonly contentHash: string;
  readonly updatedAt: number;
}

export interface GetFileInput {
  readonly projectKey: string;
  readonly filePath: string;
}

export interface UpsertFileInput {
  readonly projectKey: string;
  readonly filePath: string;
  readonly mtimeMs: number;
  readonly size: number;
  readonly contentHash: string;
}

export interface DeleteFileInput {
  readonly projectKey: string;
  readonly filePath: string;
}

export interface FileIndexRepository {
  getFile(input: GetFileInput): Promise<FileIndexEntry | null>;
  upsertFile(input: UpsertFileInput): Promise<void>;
  deleteFile(input: DeleteFileInput): Promise<void>;
}
