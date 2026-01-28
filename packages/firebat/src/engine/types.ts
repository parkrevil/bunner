import type { ParseResult, Node } from 'oxc-parser';

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


export interface LoopHeaderNode {
  type: 'ForInHeader' | 'ForOfHeader';
  start: number;
  end: number;
  left?: Node;
  right?: Node;
}

export type CfgNodePayload = Node | LoopHeaderNode;

export interface ParseTask {
  filePath: string;
  sourceText: string;
}

export interface ParsedFile {
  filePath: string;
  program: ParseResult['program'];
  errors: ParseResult['errors'];
  comments: ParseResult['comments'];
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
