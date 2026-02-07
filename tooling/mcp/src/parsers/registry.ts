/**
 * Parser Registry — §4.2 Parser Registry
 *
 * 서버 시작 시 모든 내장 파서를 등록.
 * 설정(§7)에서 파서별 enabled 플래그로 활성화/비활성화.
 * 파일 처리 시: priority 순 → canHandle === true인 모든 파서의 extract() 실행 → 결과 merge.
 *
 * @see MCP_PLAN §4.2, §4.4
 */

import type { Parser, ExtractContext, ExtractionResult } from './types';
import type { KBConfig } from '../config';

export class ParserRegistry {
	private parsers: Parser[] = [];

	/**
	 * 파서를 registry에 등록.
	 */
	register(parser: Parser): void {
		this.parsers.push(parser);
		// priority 내림차순 정렬 (높을수록 먼저 평가)
		this.parsers.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * config 기반으로 활성화된 파서만 필터링한 새 목록 반환.
	 */
	getEnabledParsers(config: KBConfig): Parser[] {
		return this.parsers.filter((p) => {
			const parserConfig = config.parsers[p.name];
			// 설정에 없으면 기본 활성화
			return parserConfig ? parserConfig.enabled : true;
		});
	}

	/**
	 * 파일에 대해 canHandle===true인 모든 활성 파서의 extract()를 실행하고 결과를 merge.
	 *
	 * @see MCP_PLAN §4.4 파서 체인
	 */
	extractAll(
		filePath: string,
		content: string,
		ctx: ExtractContext,
		config: KBConfig,
	): ExtractionResult {
		const enabled = this.getEnabledParsers(config);
		const merged: ExtractionResult = {
			entities: [],
			facts: [],
			relations: [],
			sources: [],
		};

		for (const parser of enabled) {
			if (!parser.canHandle(filePath, content)) continue;

			try {
				const result = parser.extract(filePath, content, ctx);
				merged.entities.push(...result.entities);
				merged.facts.push(...result.facts);
				merged.relations.push(...result.relations);
				merged.sources.push(...result.sources);
			} catch {
				// §3.7 에러 모델: 파서 실패 → skip, 다른 파서는 계속 실행
				continue;
			}
		}

		return merged;
	}

	/**
	 * 등록된 파서 목록.
	 */
	get all(): readonly Parser[] {
		return this.parsers;
	}
}
