/**
 * TypeScriptModuleParser (priority 90)
 *
 * 대상: *.ts, *.tsx (.d.ts 제외)
 * 추출: module entity + symbol entities (풍부한 fact 포함) + import/export relations
 *
 * AST 없이 정규식 기반으로 추출한다.
 * 정확도 < AST이지만, 외부 의존 없이 빠르게 동작한다.
 *
 * symbol entity에 추가되는 fact:
 *   - signature: 선언문 전체 시그니처 (파라미터, 리턴타입 등)
 *   - export: 내보내기 정보 (named/default)
 *   - summary: JSDoc 설명 (있을 경우)
 *   - kind: function/class/interface/type/const/enum/abstract_class
 */

import type { Parser, ExtractContext, ExtractionResult, FactDraft } from './types';
import { basename, dirname } from 'node:path';

// ── Export declaration patterns (종류별 상세 캡처) ───────────

const EXPORT_FUNCTION = /export\s+(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*(\([^)]*\))\s*(?::\s*([^{\n]+?))?\s*\{/g;
const EXPORT_CLASS = /export\s+(abstract\s+)?class\s+(\w+)\s*(<[^>]*>)?(?:\s+extends\s+([\w.]+)(?:<[^>]*>)?)?(?:\s+implements\s+([^\{]+?))?\s*\{/g;
const EXPORT_INTERFACE = /export\s+interface\s+(\w+)\s*(<[^>]*>)?(?:\s+extends\s+([^\{]+?))?\s*\{/g;
const EXPORT_TYPE = /export\s+type\s+(\w+)\s*(<[^>]*>)?\s*=\s*([^\n;]+)/g;
const EXPORT_CONST = /export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=\n]+?))?\s*=/g;
const EXPORT_ENUM = /export\s+(const\s+)?enum\s+(\w+)\s*\{/g;
const EXPORT_DEFAULT = /export\s+default\s+(async\s+)?(?:(function|class)\s+(\w+)|([\w.]+))/g;
const RE_EXPORT = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
const RE_EXPORT_ALL = /export\s+\*\s+(?:as\s+(\w+)\s+)?from\s+['"]([^'"]+)['"]/g;

// ── Other patterns ───────────────────────────────────────────

const IMPORT_PATTERN = /import\s+(?:(?:type\s+)?\{[^}]*\}|(?:type\s+)?\w+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
const JSDOC_PATTERN = /\/\*\*([\s\S]*?)\*\//g;

// ── Types ────────────────────────────────────────────────────

type SymbolKind = 'function' | 'class' | 'abstract_class' | 'interface' | 'type' | 'const' | 'enum';

type SymbolInfo = {
	name: string;
	kind: SymbolKind;
	signature: string;
	exportKind: 'named' | 'default';
	extends?: string | undefined;
	implements?: string[] | undefined;
	params?: string | undefined;
	returnType?: string | undefined;
	typeValue?: string | undefined;
	valueType?: string | undefined;
	isAsync?: boolean | undefined;
	generics?: string | undefined;
};

export class TypeScriptModuleParser implements Parser {
	name = 'typescript-module';
	priority = 90;

	canHandle(filePath: string): boolean {
		const ext = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
		if (!ext) return false;
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

		// ── Module entity ────────────────────────────────────

		result.entities.push({
			entityKey: moduleKey,
			entityType: 'module',
			summary: `TypeScript module: ${filePath}`,
			meta: { dir: dirname(filePath), fileName: basename(filePath) },
		});

		result.sources.push({
			entityKey: moduleKey,
			kind: 'code',
			filePath: ctx.filePath,
		});

		// ── JSDoc 맵 구축 ────────────────────────────────────
		// 각 JSDoc 블록의 끝 위치 → 해당 JSDoc 내용 매핑
		const jsdocMap = buildJsdocMap(content);

		// ── Exports 추출 (종류별) ────────────────────────────

		const symbols: SymbolInfo[] = [];

		// 1) Functions
		for (const m of matchAll(EXPORT_FUNCTION, content)) {
			symbols.push({
				name: m[2]!,
				kind: 'function',
				exportKind: 'named',
				isAsync: !!m[1],
				generics: m[3] ?? undefined,
				params: m[4] ?? undefined,
				returnType: m[5]?.trim() ?? undefined,
				signature: buildFunctionSig(!!m[1], m[2]!, m[3], m[4], m[5]),
			});
		}

		// 2) Classes
		for (const m of matchAll(EXPORT_CLASS, content)) {
			const isAbstract = !!m[1];
			const impls = m[5] ? m[5].split(',').map((s) => s.trim()).filter(Boolean) : undefined;
			symbols.push({
				name: m[2]!,
				kind: isAbstract ? 'abstract_class' : 'class',
				exportKind: 'named',
				generics: m[3] ?? undefined,
				extends: m[4] ?? undefined,
				implements: impls,
				signature: buildClassSig(isAbstract, m[2]!, m[3], m[4], impls),
			});
		}

		// 3) Interfaces
		for (const m of matchAll(EXPORT_INTERFACE, content)) {
			const ext = m[3] ? m[3].split(',').map((s) => s.trim()).filter(Boolean) : undefined;
			symbols.push({
				name: m[1]!,
				kind: 'interface',
				exportKind: 'named',
				generics: m[2] ?? undefined,
				extends: ext?.join(', '),
				signature: `interface ${m[1]}${m[2] ?? ''}${ext ? ` extends ${ext.join(', ')}` : ''}`,
			});
		}

		// 4) Types
		for (const m of matchAll(EXPORT_TYPE, content)) {
			symbols.push({
				name: m[1]!,
				kind: 'type',
				exportKind: 'named',
				generics: m[2] ?? undefined,
				typeValue: m[3]?.trim() ?? undefined,
				signature: `type ${m[1]}${m[2] ?? ''} = ${m[3]?.trim() ?? '...'}`,
			});
		}

		// 5) Consts / Lets / Vars
		for (const m of matchAll(EXPORT_CONST, content)) {
			symbols.push({
				name: m[1]!,
				kind: 'const',
				exportKind: 'named',
				valueType: m[2]?.trim() ?? undefined,
				signature: `const ${m[1]}${m[2] ? `: ${m[2].trim()}` : ''}`,
			});
		}

		// 6) Enums
		for (const m of matchAll(EXPORT_ENUM, content)) {
			symbols.push({
				name: m[2]!,
				kind: 'enum',
				exportKind: 'named',
				signature: `${m[1] ? 'const ' : ''}enum ${m[2]}`,
			});
		}

		// 7) Default exports
		for (const m of matchAll(EXPORT_DEFAULT, content)) {
			const name = m[3] ?? m[4] ?? 'default';
			const declKind = m[2] as 'function' | 'class' | undefined;
			// default export에 이름이 있고 아직 named로 안 잡혔으면 추가
			if (name !== 'default' && !symbols.some((s) => s.name === name)) {
				symbols.push({
					name,
					kind: declKind ?? 'const',
					exportKind: 'default',
					isAsync: !!m[1],
					signature: `export default ${declKind ? `${m[1] ?? ''}${declKind} ${name}` : name}`.trim(),
				});
			}
			// module에 default export fact
			result.facts.push({
				entityKey: moduleKey,
				factType: 'export',
				factKey: 'export:default',
				payloadText: `export default ${name}`,
				payloadJson: { name, kind: 'default' },
			});
		}

		// 8) Re-exports
		for (const m of matchAll(RE_EXPORT, content)) {
			const names = m[1]!.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean);
			const from = m[2]!;
			for (const name of names) {
				result.facts.push({
					entityKey: moduleKey,
					factType: 'export',
					factKey: `reexport:${name}:${from}`,
					payloadText: `export { ${name} } from "${from}"`,
					payloadJson: { name, from, kind: 're-export' },
				});
			}
		}

		// 9) Re-export all
		for (const m of matchAll(RE_EXPORT_ALL, content)) {
			const alias = m[1];
			const from = m[2]!;
			result.facts.push({
				entityKey: moduleKey,
				factType: 'export',
				factKey: `reexport-all:${from}`,
				payloadText: alias ? `export * as ${alias} from "${from}"` : `export * from "${from}"`,
				payloadJson: { from, alias: alias ?? null, kind: 're-export-all' },
			});
		}

		// ── Symbol entities + facts 생성 ─────────────────────

		const exportNames: string[] = [];

		for (const sym of symbols) {
			exportNames.push(sym.name);
			const symbolKey = `symbol:${filePath}#${sym.name}`;
			const jsdoc = findJsdocFor(content, sym.name, jsdocMap);

			// Entity
			result.entities.push({
				entityKey: symbolKey,
				entityType: 'symbol',
				summary: jsdoc?.summary ?? `${sym.name} (${sym.kind}, exported from ${basename(filePath)})`,
				meta: { kind: sym.kind, exportKind: sym.exportKind },
			});

			// Source
			result.sources.push({
				entityKey: symbolKey,
				kind: 'code',
				filePath: ctx.filePath,
			});

			// Fact: signature (전체 선언 시그니처)
			const sigFacts: FactDraft[] = [
				{
					entityKey: symbolKey,
					factType: 'signature',
					factKey: `signature:${sym.name}`,
					payloadText: sym.signature,
					payloadJson: buildSignaturePayload(sym),
				},
			];

			// Fact: export 정보
			sigFacts.push({
				entityKey: symbolKey,
				factType: 'export',
				factKey: `export:${sym.name}`,
				payloadText: `${sym.exportKind} export from ${basename(filePath)}`,
				payloadJson: { exportKind: sym.exportKind, module: filePath },
			});

			// Fact: kind (symbol 종류)
			sigFacts.push({
				entityKey: symbolKey,
				factType: 'kind',
				factKey: `kind:${sym.name}`,
				payloadText: sym.kind,
				payloadJson: { kind: sym.kind },
			});

			// Fact: JSDoc summary (있을 경우)
			if (jsdoc) {
				sigFacts.push({
					entityKey: symbolKey,
					factType: 'summary',
					factKey: `summary:${sym.name}`,
					payloadText: jsdoc.full,
					payloadJson: {
						summary: jsdoc.summary,
						...(jsdoc.params.length > 0 ? { params: jsdoc.params } : {}),
						...(jsdoc.returns ? { returns: jsdoc.returns } : {}),
						...(jsdoc.tags.length > 0 ? { tags: jsdoc.tags } : {}),
					},
				});
			}

			// Fact: extends / implements (class, interface)
			if (sym.extends) {
				sigFacts.push({
					entityKey: symbolKey,
					factType: 'inheritance',
					factKey: `extends:${sym.name}`,
					payloadText: `extends ${sym.extends}`,
					payloadJson: { extends: sym.extends },
				});
			}
			if (sym.implements && sym.implements.length > 0) {
				sigFacts.push({
					entityKey: symbolKey,
					factType: 'inheritance',
					factKey: `implements:${sym.name}`,
					payloadText: `implements ${sym.implements.join(', ')}`,
					payloadJson: { implements: sym.implements },
				});
			}

			result.facts.push(...sigFacts);

			// Module에도 export fact
			result.facts.push({
				entityKey: moduleKey,
				factType: 'export',
				factKey: `export:${sym.name}`,
				payloadText: `export ${sym.kind} ${sym.name}`,
				payloadJson: { name: sym.name, kind: sym.exportKind, symbolKind: sym.kind },
			});

			// Relation: symbol → module (exports)
			result.relations.push({
				srcEntityKey: moduleKey,
				dstEntityKey: symbolKey,
				relationType: 'exports',
				strength: 'implementation',
				meta: { symbolKind: sym.kind },
			});
		}

		// Module summary fact
		result.facts.push({
			entityKey: moduleKey,
			factType: 'summary',
			factKey: 'summary:module',
			payloadText: `Module ${filePath} exports: ${exportNames.join(', ') || '(none detected)'}`,
			payloadJson: { exports: exportNames },
		});

		// ── Imports 추출 → dependency facts + relations ──────

		let match: RegExpExecArray | null;
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

// ── Helpers ──────────────────────────────────────────────────

/** 정규식의 모든 매치를 배열로 반환. */
function matchAll(pattern: RegExp, text: string): RegExpExecArray[] {
	const re = new RegExp(pattern.source, pattern.flags);
	const results: RegExpExecArray[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		results.push(m);
	}
	return results;
}

/** 상대 import 경로를 repo-relative 경로로 해석. */
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

// ── Signature builders ───────────────────────────────────────

function buildFunctionSig(isAsync: boolean, name: string, generics?: string | null, params?: string | null, returnType?: string | null): string {
	let sig = isAsync ? 'async function ' : 'function ';
	sig += name;
	sig += generics ?? '';
	sig += params ?? '()';
	if (returnType) sig += `: ${returnType.trim()}`;
	return sig;
}

function buildClassSig(isAbstract: boolean, name: string, generics?: string | null, ext?: string | null, impls?: string[]): string {
	let sig = isAbstract ? 'abstract class ' : 'class ';
	sig += name;
	sig += generics ?? '';
	if (ext) sig += ` extends ${ext}`;
	if (impls && impls.length > 0) sig += ` implements ${impls.join(', ')}`;
	return sig;
}

function buildSignaturePayload(sym: SymbolInfo): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		name: sym.name,
		kind: sym.kind,
		exportKind: sym.exportKind,
		signature: sym.signature,
	};
	if (sym.isAsync) payload.async = true;
	if (sym.generics) payload.generics = sym.generics;
	if (sym.params) payload.params = sym.params;
	if (sym.returnType) payload.returnType = sym.returnType;
	if (sym.extends) payload.extends = sym.extends;
	if (sym.implements) payload.implements = sym.implements;
	if (sym.typeValue) payload.typeValue = sym.typeValue;
	if (sym.valueType) payload.valueType = sym.valueType;
	return payload;
}

// ── JSDoc extraction ─────────────────────────────────────────

type JsdocInfo = {
	summary: string;
	full: string;
	params: Array<{ name: string; description: string }>;
	returns?: string | undefined;
	tags: Array<{ tag: string; value: string }>;
};

type JsdocEntry = {
	endIndex: number;
	raw: string;
};

/** content 내 모든 JSDoc 블록의 끝 위치 → raw text 매핑. */
function buildJsdocMap(content: string): JsdocEntry[] {
	const entries: JsdocEntry[] = [];
	const re = new RegExp(JSDOC_PATTERN.source, 'g');
	let m: RegExpExecArray | null;
	while ((m = re.exec(content)) !== null) {
		entries.push({
			endIndex: m.index + m[0].length,
			raw: m[1]!,
		});
	}
	return entries;
}

/** export 선언 이름에 대응하는 JSDoc 블록을 찾아 파싱. */
function findJsdocFor(content: string, symbolName: string, entries: JsdocEntry[]): JsdocInfo | null {
	// symbolName이 포함된 export 선언의 위치를 찾음
	const exportRe = new RegExp(`export\\s+(?:async\\s+)?(?:abstract\\s+)?(?:function|class|const|let|var|interface|type|enum)\\s+${escapeRegex(symbolName)}\\b`);
	const exportMatch = exportRe.exec(content);
	if (!exportMatch) return null;

	const exportIndex = exportMatch.index;

	// export 직전에 끝나는 JSDoc 블록을 찾음 (공백/줄바꿈만 사이에)
	for (const entry of entries) {
		const gap = content.slice(entry.endIndex, exportIndex);
		if (gap.trim() === '') {
			return parseJsdoc(entry.raw);
		}
	}

	return null;
}

/** JSDoc raw text를 파싱. */
function parseJsdoc(raw: string): JsdocInfo {
	const lines = raw
		.split('\n')
		.map((l) => l.replace(/^\s*\*\s?/, '').trim())
		.filter((l) => l.length > 0);

	const summary: string[] = [];
	const params: Array<{ name: string; description: string }> = [];
	const tags: Array<{ tag: string; value: string }> = [];
	let returns: string | undefined;

	for (const line of lines) {
		if (line.startsWith('@param')) {
			const m = line.match(/@param\s+(?:\{[^}]*\}\s+)?(\w+)\s*(.*)/);
			if (m) params.push({ name: m[1]!, description: m[2] ?? '' });
		} else if (line.startsWith('@returns') || line.startsWith('@return')) {
			returns = line.replace(/@returns?\s*/, '').trim();
		} else if (line.startsWith('@')) {
			const m = line.match(/@(\w+)\s*(.*)/);
			if (m) tags.push({ tag: m[1]!, value: m[2] ?? '' });
		} else {
			summary.push(line);
		}
	}

	const summaryText = summary.join(' ').trim();
	const fullParts = [summaryText];
	if (params.length > 0) fullParts.push(`Params: ${params.map((p) => `${p.name} — ${p.description}`).join('; ')}`);
	if (returns) fullParts.push(`Returns: ${returns}`);

	return {
		summary: summaryText || '(no description)',
		full: fullParts.join('. '),
		params,
		returns,
		tags,
	};
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
