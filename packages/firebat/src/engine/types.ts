import type { Comment, Node, OxcError, Program } from 'oxc-parser';

import type { IntegerCFG } from './cfg';

export type NodeId = number;

export interface BitSet {
  add(index: number): void;
  remove(index: number): void;
  has(index: number): boolean;
  new_union(other: BitSet): BitSet;
  new_intersection(other: BitSet): BitSet;
  difference(other: BitSet): void;
  clone(): BitSet;
  equals(other: BitSet): boolean;
  array(): number[];
}

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
  readonly usedDefs: BitSet;
  readonly overwrittenDefIds: ReadonlyArray<boolean>;
  readonly defs: ReadonlyArray<DefMeta>;
}

export type NodeValue = Node | ReadonlyArray<NodeValue> | string | number | boolean | null | undefined;

export type NodeRecord = Node & Record<string, NodeValue>;

export type NodeWithBody = Node & Record<'body', Node | ReadonlyArray<Node> | null | undefined>;

export type NodeWithParams = Node & Record<'params', ReadonlyArray<Node>>;

export type NodeWithValue = Node & Record<'value', string | number | boolean | bigint | null>;

export type CfgNodePayload = Node | ReadonlyArray<Node>;

export interface ParsedFile {
  filePath: string;
  program: Program;
  errors: ReadonlyArray<OxcError>;
  comments: ReadonlyArray<Comment>;
  sourceText: string;
}

export interface OxcBuiltFunctionCfg {
  readonly cfg: IntegerCFG;
  readonly entryId: NodeId;
  readonly exitId: NodeId;
  readonly nodePayloads: ReadonlyArray<CfgNodePayload | null>;
}

export interface LoopTargets {
  readonly breakTarget: NodeId;
  readonly continueTarget: NodeId;
  readonly label: string | null;
}
