import type { IntegerCFG } from './cfg';
import type { IBitSet } from './dataflow';

export type NodeId = number;

export enum EdgeType {
  Normal = 0,
  True = 1,
  False = 2,
  Exception = 3,
}

export interface VariableUsage {
  name: string;
  isWrite: boolean;
  isRead: boolean;
  location: number;
  writeKind?: 'declaration' | 'assignment' | 'compound-assignment' | 'logical-assignment' | 'update';
}

export interface VariableCollectorOptions {
  includeNestedFunctions?: boolean;
}

export interface DefMeta {
  readonly name: string;
  readonly varIndex: number;
  readonly location: number;
  readonly writeKind?: VariableUsage['writeKind'];
}

export interface FunctionBodyAnalysis {
  readonly usedDefs: IBitSet;
  readonly overwrittenDefIds: ReadonlyArray<boolean>;
  readonly defs: ReadonlyArray<DefMeta>;
}

export interface RoaringBitmap32Instance {
  add(index: number): void;
  remove(index: number): void;
  has(index: number): boolean;
  orInPlace(other: RoaringBitmap32Instance): void;
  andInPlace(other: RoaringBitmap32Instance): void;
  andNotInPlace(other: RoaringBitmap32Instance): void;
  isEmpty: boolean;
  isEqual(other: RoaringBitmap32Instance): boolean;
  toArray(): number[];
}

export type RoaringBitmap32Ctor = new (bitmap?: RoaringBitmap32Instance) => RoaringBitmap32Instance;

export type OxcNodeValue =
  | string
  | number
  | boolean
  | null
  | OxcNode
  | ReadonlyArray<OxcNodeValue>;

export interface OxcNode {
  type?: string;
  name?: string;
  start?: number;
  end?: number;
  [key: string]: OxcNodeValue | undefined;
  expression?: OxcNode;
  properties?: ReadonlyArray<OxcNode>;
  key?: OxcNode;
  value?: OxcNodeValue;
  operator?: string;
  argument?: OxcNode;
  computed?: boolean;
  property?: OxcNode;
  object?: OxcNode;
  callee?: OxcNode;
  left?: OxcNode;
  right?: OxcNode;
  test?: OxcNode;
  consequent?: OxcNode | ReadonlyArray<OxcNode>;
  alternate?: OxcNode;
  init?: OxcNode;
  update?: OxcNode;
  id?: OxcNode;
  arguments?: ReadonlyArray<OxcNode>;
  params?: ReadonlyArray<OxcNode>;
  body?: OxcNode | ReadonlyArray<OxcNode>;
  label?: OxcNode;
  discriminant?: OxcNode;
  cases?: ReadonlyArray<OxcNode>;
  argument?: OxcNode;
  handler?: OxcNode;
  block?: OxcNode;
  finalizer?: OxcNode;
}

export interface OxcParseResult {
  program: OxcNode;
  errors: ReadonlyArray<OxcNode>;
  comments: ReadonlyArray<OxcNode>;
}

export interface ParseSyncModule {
  parseSync?: ParseSyncFn;
}

export type ParseSyncFn = (filePath: string, sourceText: string) => OxcParseResult;

export interface ParseTask {
  filePath: string;
  sourceText: string;
}

export interface ParsedFile {
  filePath: string;
  program: OxcNode;
  errors: ReadonlyArray<OxcNode>;
  comments: ReadonlyArray<OxcNode>;
  sourceText: string;
}

export interface OxcBuiltFunctionCfg {
  readonly cfg: IntegerCFG;
  readonly entryId: NodeId;
  readonly exitId: NodeId;
  readonly nodePayloads: ReadonlyArray<OxcNode | null>;
}

export interface LoopTargets {
  readonly breakTarget: NodeId;
  readonly continueTarget: NodeId;
  readonly label: string | null;
}
