/**
 * TypeScriptModuleParser — §4.3 TypeScriptModuleParser (priority 90)
 *
 * 대상: **\/*.ts, **\/*.tsx (test 파일 제외 — TestFileParser에서 처리)
 * 추출: module/symbol entities + export/import relations
 *
 * AST 없이 정규식 기반으로 기본 module/export/import를 추출한다.
 * 정확도 < AST이지만, 외부 의존 없이 빠르게 동작한다.
 *
 * @see MCP_PLAN §4.3, §4.5a
 */

import type { Parser, ExtractContext, ExtractionResult } from './types';
import { basename, dirname } from 'node:path';

// ── Regex patterns ───────────────────────────────────────────

const EXPORT_PATTERNS = {
	namedExport: /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/g,
	defaultExport: /export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/g,
	reExport: /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
	reExportAll: /export\s+\*\s+(?:as\s+(\w+)\s+)?from\s+['"]([^'"]+)['"]/g,
};

const IMPORT_PATTERN = /import\s+(?:(?:type\s+)?\{[^}]*\}|(?:type\s+)?\w+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;

export class TypeScriptModuleParser implements Parser {
	name = 'typescript-module';
	priority = 90;

	canHandle(filePath: string): boolean {
		const ext = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
		if (!ext) return false;

		// test 파일은 TestFileParser가 담당 — 하지만 §4.4 파서 체인에 의해 둘 다 적용 가능
		// 여기서는 .d.ts 파일만 제외
		if (filePath.endsWith('.d.ts')) return false;

		return true;
	}

	extract(filePath: string, content: string, ctx: ExtractContext): ExtractionResult {
		const result: ExtractionResult = {
			entities: [],
			facts: [],
			relations: [],
			sources: [],
		};

		const moduleKey = `module:${filePath}`;

		// Module entity
		result.entities.push({
			entityKey: moduleKey,
			entityType: 'module',
			summary: `TypeScript module: ${filePath}`,
			meta: {
				dir: dirname(filePath),
				fileName: basename(filePath),
			},
		});

		// Source
		result.sources.push({
			entityKey: moduleKey,
			kind: 'code',
			filePath: ctx.filePath,
		});

		// ── Exports 추출 ─────────────────────────────────────

		const exports: string[] = [];

		// named exports
		let match: RegExpExecArray | null;
		const namedPattern = new RegExp(EXPORT_PATTERNS.namedExport.source, 'g');
		while ((match = namedPattern.exec(content)) !== null) {
			const name = match[1]!;
			exports.push(name);

			result.entities.push({
				entityKey: `symbol:${filePath}#${name}`,
				entityType: 'symbol',
				summary: `${name} (exported from ${basename(filePath)})`,
			});

			result.sources.push({
				entityKey: `symbol:${filePath}#${name}`,
				kind: 'code',
				filePath: ctx.filePath,
			});

			result.facts.push({
				entityKey: moduleKey,
				factType: 'signature',
				factKey: `export:${name}`,
				payloadText: `export ${name}`,
				payloadJson: { name, kind: 'named' },
			});
		}

		// default exports
		const defaultPattern = new RegExp(EXPORT_PATTERNS.defaultExport.source, 'g');
		while ((match = defaultPattern.exec(content)) !== null) {
			const name = match[1]!;
			exports.push(name);

			result.facts.push({
				entityKey: moduleKey,
				factType: 'signature',
				factKey: 'export:default',
				payloadText: `export default ${name}`,
				payloadJson: { name, kind: 'default' },
			});
		}

		// re-exports
		const reExportPattern = new RegExp(EXPORT_PATTERNS.reExport.source, 'g');
		while ((match = reExportPattern.exec(content)) !== null) {
			const names = match[1]!.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean);
			const from = match[2]!;

			for (const name of names) {
				result.facts.push({
					entityKey: moduleKey,
					factType: 'signature',
					factKey: `reexport:${name}:${from}`,
					payloadText: `export { ${name} } from "${from}"`,
					payloadJson: { name, from, kind: 're-export' },
				});
			}
		}

		// Module summary fact
		result.facts.push({
			entityKey: moduleKey,
			factType: 'summary',
			factKey: 'summary:module',
			payloadText: `Module ${filePath} exports: ${exports.join(', ') || '(none detected)'}`,
			payloadJson: { exports },
		});

		// ── Imports 추출 → dependency relations ──────────────

		const importPattern = new RegExp(IMPORT_PATTERN.source, 'g');
		const seenImports = new Set<string>();

		while ((match = importPattern.exec(content)) !== null) {
			const importFrom = match[1]!;
			if (seenImports.has(importFrom)) continue;
			seenImports.add(importFrom);

			result.facts.push({
				entityKey: moduleKey,
				factType: 'dependency',
				factKey: `dependency:${importFrom}`,
				payloadText: `imports from "${importFrom}"`,
				payloadJson: { from: importFrom },
			});

			// 상대 경로 import → 프로젝트 내부 모듈 관계
			if (importFrom.startsWith('.') || importFrom.startsWith('/')) {
				const resolvedPath = resolveImportPath(filePath, importFrom);
				const dstKey = `module:${resolvedPath}`;

				result.relations.push({
					srcEntityKey: moduleKey,
					dstEntityKey: dstKey,
					relationType: 'depends_on',
					strength: 'implementation',
					meta: { importPath: importFrom },
				});
			}

			// 패키지 import → pkg entity 관계
			if (!importFrom.startsWith('.') && !importFrom.startsWith('/')) {
				const pkgName = importFrom.startsWith('@')
					? importFrom.split('/').slice(0, 2).join('/')
					: importFrom.split('/')[0]!;

				const dstKey = `pkg:${pkgName}`;
				if (ctx.existingEntities.has(dstKey)) {
					result.relations.push({
						srcEntityKey: moduleKey,
						dstEntityKey: dstKey,
						relationType: 'depends_on',
						strength: 'implementation',
						meta: { importPath: importFrom },
					});
				}
			}
		}

		return result;
	}
}

/**
 * 상대 import 경로를 repo-relative 경로로 해석.
 * 정확한 확장자 해석은 하지 않음 (간략화).
 */
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

	// 확장자 추정 (.ts)
	if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
		resolved += '.ts';
	}

	return resolved;
}
