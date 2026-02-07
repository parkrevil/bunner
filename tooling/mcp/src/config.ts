import { resolve } from 'path';

/**
 * KB 설정 파일 인터페이스.
 * @see MCP_PLAN §7.3
 */
export interface KBConfig {
  watch: {
    include: string[];
    debounceMs: number;
  };
  scan: {
    exclude: {
      dirs: string[];
      files: string[];
      extensions: string[];
      patterns: string[];
    };
    maxFileSizeBytes: number;
  };
  parsers: Record<string, { enabled: boolean; module?: string }>;
  sync: {
    fullScanOnStartup: boolean;
    readThroughValidation: boolean;
    workerConcurrency: number;
  };
  search: {
    defaultLimit: number;
    defaultMode: 'lexical' | 'vector' | 'hybrid';
  };
  audit: {
    retentionDays: number;
  };
}

/**
 * 기본 설정.
 * bunner.kb.jsonc 가 없을 때 사용.
 * @see MCP_PLAN §7.2
 */
export const DEFAULT_CONFIG: KBConfig = {
  watch: {
    include: ['examples/', 'packages/'],
    debounceMs: 500,
  },
  scan: {
    exclude: {
      dirs: ['node_modules', 'dist', '.git', 'coverage', '.turbo'],
      files: ['bun.lockb', 'package-lock.json', 'yarn.lock', '.DS_Store'],
      extensions: ['.png', '.jpg', '.woff', '.wasm', '.sqlite'],
      patterns: ['.env*'],
    },
    maxFileSizeBytes: 1_048_576, // 1MB
  },
  parsers: {
    'package-json': { enabled: true },
    'typescript-module': { enabled: true },
    'test-file': { enabled: true },
    'spec-markdown': { enabled: false },
    'generic-markdown': { enabled: false },
  },
  sync: {
    fullScanOnStartup: true,
    readThroughValidation: true,
    workerConcurrency: 1,
  },
  search: {
    defaultLimit: 10,
    defaultMode: 'lexical',
  },
  audit: {
    retentionDays: 30,
  },
};

/**
 * 두 객체를 재귀적으로 deep merge.
 * file 값이 undefined 이면 defaults 유지.
 */
function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Record<string, unknown>): T {
  const result = { ...defaults };

  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    const def = (defaults as Record<string, unknown>)[key];

    if (val === undefined) continue;

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      def !== null &&
      typeof def === 'object' &&
      !Array.isArray(def)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        def as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      (result as Record<string, unknown>)[key] = val;
    }
  }

  return result;
}

/**
 * JSONC 에서 주석을 제거.
 * 단순 라인 주석( // ) 과 블록 주석만 처리.
 */
function stripJsonComments(text: string): string {
  // 문자열 리터럴 내부의 슬래시는 건드리지 않도록
  // 간단한 정규식으로 처리 (복잡한 edge-case는 생략)
  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (escape) {
      result += ch;
      escape = false;
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') escape = true;
      if (ch === '"') inString = false;
      result += ch;
      i++;
      continue;
    }

    // 문자열 시작
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }

    // 라인 주석
    if (ch === '/' && text[i + 1] === '/') {
      // 줄 끝까지 스킵
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    // 블록 주석
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2; // skip */
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * bunner.kb.jsonc 를 로드하고 DEFAULT_CONFIG 와 merge.
 *
 * 파일이 없으면 DEFAULT_CONFIG 그대로 반환.
 * 파일이 있지만 파싱 실패 시 에러를 throw 하지 않고 DEFAULT_CONFIG 반환 + 경고 로그.
 *
 * @see MCP_PLAN §7.1, §7.2
 */
export async function loadConfig(repoRoot?: string): Promise<KBConfig> {
  const root = repoRoot ?? process.cwd();
  const configPath = resolve(root, 'bunner.kb.jsonc');

  const file = Bun.file(configPath);
  const exists = await file.exists();

  if (!exists) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = await file.text();
    const stripped = stripJsonComments(raw);
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, parsed) as unknown as KBConfig;
  } catch (err) {
    console.warn(`[bunner-kb] Failed to parse ${configPath}, using defaults:`, err);
    return { ...DEFAULT_CONFIG };
  }
}
