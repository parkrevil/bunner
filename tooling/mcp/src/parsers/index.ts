/**
 * Parsers barrel export — 내장 파서 모음 + registry 초기화.
 */

export { ParserRegistry } from './registry';
export type { Parser, ExtractContext, ExtractionResult, EntityDraft, FactDraft, RelationDraft, SourceDraft, EntityRef } from './types';

export { PackageJsonParser } from './package-json';
export { TypeScriptModuleParser } from './typescript-module';
export { TestFileParser } from './test-file';

import { ParserRegistry } from './registry';
import { PackageJsonParser } from './package-json';
import { TypeScriptModuleParser } from './typescript-module';
import { TestFileParser } from './test-file';

/**
 * 모든 내장 파서가 등록된 기본 registry 생성.
 *
 * @see MCP_PLAN §4.2
 */
export function createDefaultRegistry(): ParserRegistry {
	const registry = new ParserRegistry();
	registry.register(new PackageJsonParser());
	registry.register(new TypeScriptModuleParser());
	registry.register(new TestFileParser());
	return registry;
}
