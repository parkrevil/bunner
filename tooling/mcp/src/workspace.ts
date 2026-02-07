import { hostname } from 'os';

/**
 * Workspace ID — 격리 단위.
 *
 * `sha256(hostname + repo_root_path)`의 앞 16자.
 * 환경변수 불필요 — `os.hostname()` + `process.cwd()` 로 자동 계산.
 *
 * @see MCP_PLAN §1.5
 */
export function computeWorkspaceId(repoRoot?: string): string {
  const host = hostname();
  const root = repoRoot ?? process.cwd();
  const raw = `${host}${root}`;

  const hash = new Bun.CryptoHasher('sha256').update(raw).digest('hex');
  return hash.slice(0, 16);
}

/**
 * Workspace row upsert 에 필요한 메타데이터.
 */
export function getWorkspaceMeta(repoRoot?: string): {
  id: string;
  hostname: string;
  repoRoot: string;
} {
  const host = hostname();
  const root = repoRoot ?? process.cwd();
  return {
    id: computeWorkspaceId(root),
    hostname: host,
    repoRoot: root,
  };
}
