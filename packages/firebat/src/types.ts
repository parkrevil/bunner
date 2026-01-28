import type {
  ArrowFunction,
  ConstructorDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  GetAccessorDeclaration,
  Identifier,
  MethodDeclaration,
  SetAccessorDeclaration,
  Symbol as TypeScriptSymbol,
} from 'typescript';

export type OutputFormat = 'text' | 'json';

export type FirebatDetector = 'duplicates' | 'waste';

export type FirebatItemKind = 'function' | 'method' | 'type' | 'interface' | 'node';

export type ResourceWasteKind = 'dead-store' | 'dead-store-overwrite';

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

export interface StaticObjectSourceKey {
  kind: 'object';
  propertyKey: string;
}

export interface StaticArraySourceKey {
  kind: 'array';
  index: number;
}

export type StaticSourceKey = StaticObjectSourceKey | StaticArraySourceKey;

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

export interface ResourceWasteFinding {
  readonly kind: ResourceWasteKind;
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

export interface FirebatReport {
  readonly meta: FirebatMeta;
  readonly duplicates: ReadonlyArray<DuplicateGroup>;
  readonly waste: ReadonlyArray<ResourceWasteFinding>;
}

export interface NodeHeader {
  readonly kind: FirebatItemKind;
  readonly header: string;
}

export type FunctionWithBodyNode =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunction
  | MethodDeclaration
  | ConstructorDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration;

export interface ControlFlowStateBucket {
  readonly label: string | null;
  readonly acceptsUnlabeled: boolean;
  readonly states: Array<Map<TypeScriptSymbol, Map<number, Identifier>>>;
}
