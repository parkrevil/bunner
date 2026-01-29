export type OutputFormat = 'text' | 'json';

export type MinTokensOption = number | 'auto';

export type FirebatDetector =
  | 'duplicates'
  | 'waste'
  | 'dependencies'
  | 'coupling'
  | 'duplication'
  | 'nesting'
  | 'early-return'
  | 'noop'
  | 'api-drift';

export type FirebatItemKind = 'function' | 'method' | 'type' | 'interface' | 'node';

export type WasteKind = 'dead-store' | 'dead-store-overwrite';

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface DuplicateItem {
  readonly kind: FirebatItemKind;
  readonly header: string;
  readonly filePath: string;
  readonly span: SourceSpan;
  readonly tokens: number;
}

export interface DuplicateGroup {
  readonly fingerprint: string;
  readonly items: ReadonlyArray<DuplicateItem>;
}

export interface DependencyCycle {
  readonly path: ReadonlyArray<string>;
}

export interface DependencyFanStat {
  readonly module: string;
  readonly count: number;
}

export interface DependencyEdgeCutHint {
  readonly from: string;
  readonly to: string;
  readonly score?: number;
  readonly reason?: string;
}

export interface DependencyAnalysis {
  readonly cycles: ReadonlyArray<DependencyCycle>;
  readonly fanInTop: ReadonlyArray<DependencyFanStat>;
  readonly fanOutTop: ReadonlyArray<DependencyFanStat>;
  readonly edgeCutHints: ReadonlyArray<DependencyEdgeCutHint>;
}

export interface CouplingHotspot {
  readonly module: string;
  readonly score: number;
  readonly signals: ReadonlyArray<string>;
}

export interface CouplingAnalysis {
  readonly hotspots: ReadonlyArray<CouplingHotspot>;
}

export interface DuplicationAnalysis {
  readonly cloneClasses: ReadonlyArray<DuplicateGroup>;
}

export interface NestingMetrics {
  readonly depth: number;
  readonly decisionPoints: number;
}

export interface NestingItem {
  readonly filePath: string;
  readonly header: string;
  readonly span: SourceSpan;
  readonly metrics: NestingMetrics;
  readonly score: number;
  readonly suggestions: ReadonlyArray<string>;
}

export interface NestingAnalysis {
  readonly items: ReadonlyArray<NestingItem>;
}

export interface EarlyReturnMetrics {
  readonly earlyReturnCount: number;
  readonly hasGuardClauses: boolean;
}

export interface EarlyReturnItem {
  readonly filePath: string;
  readonly header: string;
  readonly span: SourceSpan;
  readonly metrics: EarlyReturnMetrics;
  readonly score: number;
  readonly suggestions: ReadonlyArray<string>;
}

export interface EarlyReturnAnalysis {
  readonly items: ReadonlyArray<EarlyReturnItem>;
}

export interface NoopFinding {
  readonly kind: string;
  readonly filePath: string;
  readonly span: SourceSpan;
  readonly confidence: number;
  readonly evidence: string;
}

export interface NoopAnalysis {
  readonly findings: ReadonlyArray<NoopFinding>;
}

export interface ApiDriftShape {
  readonly paramsCount: number;
  readonly optionalCount: number;
  readonly returnKind: string;
  readonly async: boolean;
}

export interface ApiDriftOutlier {
  readonly shape: ApiDriftShape;
}

export interface ApiDriftGroup {
  readonly label: string;
  readonly standardCandidate: ApiDriftShape;
  readonly outliers: ReadonlyArray<ApiDriftOutlier>;
}

export interface ApiDriftAnalysis {
  readonly groups: ReadonlyArray<ApiDriftGroup>;
}

export interface WasteFinding {
  readonly kind: WasteKind;
  readonly label: string;
  readonly filePath: string;
  readonly span: SourceSpan;
}

export interface FirebatMeta {
  readonly engine: 'oxc';
  readonly version: string;
  readonly targetCount: number;
  readonly minTokens: number;
  readonly detectors: ReadonlyArray<FirebatDetector>;
}

export interface FirebatAnalyses {
  readonly duplicates: ReadonlyArray<DuplicateGroup>;
  readonly waste: ReadonlyArray<WasteFinding>;
  readonly dependencies: DependencyAnalysis;
  readonly coupling: CouplingAnalysis;
  readonly duplication: DuplicationAnalysis;
  readonly nesting: NestingAnalysis;
  readonly earlyReturn: EarlyReturnAnalysis;
  readonly noop: NoopAnalysis;
  readonly apiDrift: ApiDriftAnalysis;
}

export interface FirebatReport {
  readonly meta: FirebatMeta;
  readonly analyses: FirebatAnalyses;
}

export interface NodeHeader {
  readonly kind: FirebatItemKind;
  readonly header: string;
}
