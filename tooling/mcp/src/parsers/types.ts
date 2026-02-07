/**
 * Parser Interface — §4.1 Parser Interface
 *
 * 파서 시스템의 핵심 타입 정의.
 * 모든 파서는 이 인터페이스를 구현한다.
 *
 * @see MCP_PLAN §4.1, §4.2
 */

// ── Entity Draft ─────────────────────────────────────────────

export type EntityDraft = {
	entityKey: string;
	entityType: string;
	summary?: string;
	meta?: Record<string, unknown>;
};

// ── Source Draft ──────────────────────────────────────────────

export type SourceDraft = {
	entityKey: string;
	kind: string; // spec | code | test | config | doc
	filePath: string;
	spanStart?: number;
	spanEnd?: number;
};

// ── Fact Draft ───────────────────────────────────────────────

export type FactDraft = {
	entityKey: string;
	factType: string;
	factKey: string;
	payloadText?: string;
	payloadJson?: Record<string, unknown>;
};

// ── Relation Draft ───────────────────────────────────────────

export type RelationDraft = {
	srcEntityKey: string;
	dstEntityKey: string;
	relationType: string;
	strength: string;
	meta?: Record<string, unknown>;
};

// ── Extract Context ──────────────────────────────────────────

export type EntityRef = {
	id: number;
	entityKey: string;
	entityType: string;
};

export type ExtractContext = {
	workspaceId: string;
	filePath: string;
	contentHash: string;
	existingEntities: Map<string, EntityRef>; // entity_key → ref (relation linking에 사용)
};

// ── Extraction Result ────────────────────────────────────────

export type ExtractionResult = {
	entities: EntityDraft[];
	facts: FactDraft[];
	relations: RelationDraft[];
	sources: SourceDraft[];
};

// ── Parser Interface ─────────────────────────────────────────

export interface Parser {
	/** 파서 이름 (설정에서 활성화/비활성화에 사용) */
	name: string;

	/** 이 파서가 해당 파일을 처리할 수 있는지 */
	canHandle(filePath: string, content: string): boolean;

	/** 파일에서 entity, fact, relation, source를 추출 */
	extract(filePath: string, content: string, ctx: ExtractContext): ExtractionResult;

	/** 높을수록 먼저 평가 */
	priority: number;
}
