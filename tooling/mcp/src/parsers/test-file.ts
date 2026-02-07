/**
 * TestFileParser — §4.3 TestFileParser (priority 80)
 *
 * 대상: **\/*.test.ts, **\/*.spec.ts
 * 추출: test entities + tests relations
 *
 * describe/it/test 블록을 정규식으로 파싱하여 test entity를 생성하고,
 * import된 모듈과 tests relation을 형성한다.
 *
 * @see MCP_PLAN §4.3, §4.5b
 */

import type { Parser, ExtractContext, ExtractionResult } from './types';
import { basename, dirname } from 'node:path';

// ── Regex patterns ───────────────────────────────────────────

const DESCRIBE_PATTERN = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
const IT_PATTERN = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const IMPORT_PATTERN = /import\s+(?:(?:type\s+)?\{[^}]*\}|(?:type\s+)?\w+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;

export class TestFileParser implements Parser {
	name = 'test-file';
	priority = 80;

	canHandle(filePath: string): boolean {
		return filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts');
	}

	extract(filePath: string, content: string, ctx: ExtractContext): ExtractionResult {
		const result: ExtractionResult = {
			entities: [],
			facts: [],
			relations: [],
			sources: [],
		};

		// ── describe 블록 파싱 ───────────────────────────────

		const describes: string[] = [];
		let match: RegExpExecArray | null;
		const describePattern = new RegExp(DESCRIBE_PATTERN.source, 'g');
		while ((match = describePattern.exec(content)) !== null) {
			describes.push(match[1]!);
		}

		// ── test case 파싱 ───────────────────────────────────

		const testCases: string[] = [];
		const itPattern = new RegExp(IT_PATTERN.source, 'g');
		while ((match = itPattern.exec(content)) !== null) {
			testCases.push(match[1]!);
		}

		// ── Test file entity ─────────────────────────────────

		const fileKey = `test:${filePath}`;
		const topDescribe = describes[0] ?? basename(filePath, '.test.ts').replace('.spec', '');

		result.entities.push({
			entityKey: fileKey,
			entityType: 'test',
			summary: `Test suite: ${topDescribe} (${testCases.length} tests)`,
			meta: {
				describes,
				testCount: testCases.length,
			},
		});

		result.sources.push({
			entityKey: fileKey,
			kind: 'test',
			filePath: ctx.filePath,
		});

		// ── 개별 test case entity + facts ────────────────────

		for (const testName of testCases) {
			const testKey = `test:${filePath}#${slugify(testName)}`;

			result.entities.push({
				entityKey: testKey,
				entityType: 'test',
				summary: testName,
			});

			result.sources.push({
				entityKey: testKey,
				kind: 'test',
				filePath: ctx.filePath,
			});

			result.facts.push({
				entityKey: testKey,
				factType: 'test_assertion',
				factKey: `test-case:${slugify(testName)}`,
				payloadText: testName,
				payloadJson: { name: testName, suite: topDescribe },
			});

			// test case → test file relation
			result.relations.push({
				srcEntityKey: testKey,
				dstEntityKey: fileKey,
				relationType: 'relates_to',
				strength: 'implementation',
			});
		}

		// ── Summary fact ─────────────────────────────────────

		result.facts.push({
			entityKey: fileKey,
			factType: 'summary',
			factKey: 'summary:test-suite',
			payloadText: `Test suite "${topDescribe}": ${testCases.join(', ') || '(no tests detected)'}`,
			payloadJson: { describes, testCases },
		});

		// ── Import 분석 → tests relation ─────────────────────

		const importPattern = new RegExp(IMPORT_PATTERN.source, 'g');
		const seenImports = new Set<string>();

		while ((match = importPattern.exec(content)) !== null) {
			const importFrom = match[1]!;
			if (seenImports.has(importFrom)) continue;
			seenImports.add(importFrom);

			// 상대 import → 테스트 대상 모듈
			if (importFrom.startsWith('.') || importFrom.startsWith('/')) {
				const resolvedPath = resolveImportPath(filePath, importFrom);
				const dstKey = `module:${resolvedPath}`;

				result.relations.push({
					srcEntityKey: fileKey,
					dstEntityKey: dstKey,
					relationType: 'tests',
					strength: 'implementation',
					meta: { importPath: importFrom },
				});
			}
		}

		return result;
	}
}

// ── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function resolveImportPath(fromFilePath: string, importPath: string): string {
	const fromDir = dirname(fromFilePath);
	const segments = fromDir.split('/');
	const importParts = importPath.split('/');

	for (const part of importParts) {
		if (part === '.') continue;
		if (part === '..') {
			segments.pop();
		} else {
			segments.push(part);
		}
	}

	let resolved = segments.join('/');
	if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
		resolved += '.ts';
	}

	return resolved;
}
