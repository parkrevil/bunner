import * as path from 'node:path';

import { getOrmDb } from '../../infrastructure/sqlite/firebat.db';
import { createSqliteMemoryRepository } from '../../infrastructure/sqlite/memory.repository';
import { createInMemoryMemoryRepository } from '../../infrastructure/memory/memory.repository';
import { createHybridMemoryRepository } from '../../infrastructure/hybrid/memory.repository';

interface JsonObject {
  readonly [k: string]: JsonValue;
}

type JsonValue = null | boolean | number | string | ReadonlyArray<JsonValue> | JsonObject;

interface RootInput {
  readonly root?: string;
}

interface ReadMemoryInput {
  readonly root?: string;
  readonly memoryKey: string;
}

interface ReadMemoryOutput {
  readonly memoryKey: string;
  readonly value: JsonValue;
}

interface WriteMemoryInput {
  readonly root?: string;
  readonly memoryKey: string;
  readonly value: JsonValue;
}

interface DeleteMemoryInput {
  readonly root?: string;
  readonly memoryKey: string;
}

const resolveProjectKey = (root: string | undefined): string => {
  const cwd = process.cwd();

  if (root === undefined || root.trim().length === 0) {
    return path.resolve(cwd);
  }

  const trimmed = root.trim();

  return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
};

const getRepository = async () => {
  const orm = await getOrmDb();

  return createHybridMemoryRepository({
    memory: createInMemoryMemoryRepository(),
    sqlite: createSqliteMemoryRepository(orm),
  });
};

const listMemoriesUseCase = async (input: RootInput) => {
  const projectKey = resolveProjectKey(input.root);
  const repo = await getRepository();

  return repo.listKeys({ projectKey });
};

const readMemoryUseCase = async (input: ReadMemoryInput): Promise<ReadMemoryOutput | null> => {
  const projectKey = resolveProjectKey(input.root);
  const repo = await getRepository();
  const rec = await repo.read({ projectKey, memoryKey: input.memoryKey });

  if (!rec) {
    return null;
  }

  try {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return { memoryKey: input.memoryKey, value: JSON.parse(rec.payloadJson) as JsonValue };
  } catch {
    return { memoryKey: input.memoryKey, value: rec.payloadJson };
  }
};

const writeMemoryUseCase = async (input: WriteMemoryInput): Promise<void> => {
  const projectKey = resolveProjectKey(input.root);
  const repo = await getRepository();
  const payloadJson = JSON.stringify(input.value);

  await repo.write({ projectKey, memoryKey: input.memoryKey, payloadJson });
};

const deleteMemoryUseCase = async (input: DeleteMemoryInput): Promise<void> => {
  const projectKey = resolveProjectKey(input.root);
  const repo = await getRepository();

  await repo.delete({ projectKey, memoryKey: input.memoryKey });
};

export {
  listMemoriesUseCase,
  readMemoryUseCase,
  writeMemoryUseCase,
  deleteMemoryUseCase,
};
