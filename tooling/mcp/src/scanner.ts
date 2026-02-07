/**
 * File Scanner — §3.2 Startup Full Scan
 *
 * Glob.scan + content_hash(SHA-256) via Bun.CryptoHasher streaming.
 * 설정된 include 디렉토리를 재귀 탐색하고, exclude 규칙을 적용한 후
 * 각 파일의 content_hash를 계산한다.
 *
 * @see MCP_PLAN §3.2, §8.1, §8.8
 */

import { Glob } from 'bun';
import { resolve, relative, extname, basename, dirname } from 'node:path';
import type { KBConfig } from './config';

export type ScannedFile = {
	/** repo-relative path */
	filePath: string;
	/** SHA-256 hex digest of file content */
	contentHash: string;
};

/**
 * 파일 content_hash 계산 — streaming hash로 큰 파일도 메모리 전체 로드 없이 처리.
 *
 * @see MCP_PLAN §1.7, §8.1, §8.8
 */
export async function computeContentHash(absolutePath: string): Promise<string> {
	const file = Bun.file(absolutePath);
	const stream = file.stream();
	const hasher = new Bun.CryptoHasher('sha256');

	for await (const chunk of stream) {
		hasher.update(chunk);
	}

	return hasher.digest('hex');
}

/**
 * exclude 규칙에 매칭되는지 검사.
 */
function isExcluded(
	filePath: string,
	exclude: KBConfig['scan']['exclude'],
): boolean {
	const name = basename(filePath);
	const ext = extname(filePath);
	const dir = dirname(filePath);
	const segments = dir.split('/');

	// dirs
	for (const d of exclude.dirs) {
		if (segments.includes(d)) return true;
	}

	// files
	if (exclude.files.includes(name)) return true;

	// extensions
	if (ext && exclude.extensions.includes(ext)) return true;

	// patterns (glob-style — 간단한 .env* 패턴 매칭)
	for (const pattern of exclude.patterns) {
		if (pattern.endsWith('*')) {
			const prefix = pattern.slice(0, -1);
			if (name.startsWith(prefix)) return true;
		} else if (name === pattern) {
			return true;
		}
	}

	return false;
}

/**
 * 전체 파일 스캔.
 *
 * config.watch.include 디렉토리를 재귀 탐색하고,
 * config.scan.exclude 규칙 적용, maxFileSizeBytes 초과 파일 제외 후
 * content_hash를 계산하여 ScannedFile 목록을 반환한다.
 *
 * @see MCP_PLAN §3.2 Layer 1: Startup — Background Full Scan
 */
export async function scanFiles(
	repoRoot: string,
	config: KBConfig,
): Promise<ScannedFile[]> {
	const results: ScannedFile[] = [];
	const glob = new Glob('**/*');

	for (const dir of config.watch.include) {
		const absDir = resolve(repoRoot, dir);

		for await (const file of glob.scan({ cwd: absDir })) {
			const relPath = relative(repoRoot, resolve(absDir, file));

			if (isExcluded(relPath, config.scan.exclude)) continue;

			const absPath = resolve(repoRoot, relPath);

			// maxFileSizeBytes 체크
			try {
				const bunFile = Bun.file(absPath);
				if (bunFile.size > config.scan.maxFileSizeBytes) continue;
			} catch {
				// 파일 접근 실패 → skip
				continue;
			}

			try {
				const contentHash = await computeContentHash(absPath);
				results.push({ filePath: relPath, contentHash });
			} catch {
				// 해시 계산 실패 → skip (§3.7 에러 모델: 개별 파일 실패는 전체 중단하지 않음)
				continue;
			}
		}
	}

	return results;
}
