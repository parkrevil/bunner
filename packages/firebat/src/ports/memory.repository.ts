export interface MemoryRecord {
  readonly projectKey: string;
  readonly memoryKey: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly payloadJson: string;
}

export interface MemoryKeyEntry {
  readonly memoryKey: string;
  readonly updatedAt: number;
}

export interface ListMemoryKeysInput {
  readonly projectKey: string;
}

export interface ReadMemoryInput {
  readonly projectKey: string;
  readonly memoryKey: string;
}

export interface WriteMemoryInput {
  readonly projectKey: string;
  readonly memoryKey: string;
  readonly payloadJson: string;
}

export interface DeleteMemoryInput {
  readonly projectKey: string;
  readonly memoryKey: string;
}

export interface MemoryRepository {
  listKeys(input: ListMemoryKeysInput): Promise<ReadonlyArray<MemoryKeyEntry>>;
  read(input: ReadMemoryInput): Promise<MemoryRecord | null>;
  write(input: WriteMemoryInput): Promise<void>;
  delete(input: DeleteMemoryInput): Promise<void>;
}
