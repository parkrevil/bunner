import type { Node } from 'oxc-parser';

import { IntegerCFG } from './cfg';
import { EdgeType, type CfgNodePayload, type LoopTargets, type NodeId, type NodeValue, type OxcBuiltFunctionCfg } from './types';

const isOxcNode = (value: NodeValue): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: NodeValue): value is ReadonlyArray<Node> => Array.isArray(value);

const getNodeName = (node: NodeValue): string | null => {
  if (!isOxcNode(node)) {
    return null;
  }

  if ('name' in node && typeof node.name === 'string') {
    return node.name;
  }

  return null;
};

const unwrapExpression = (node: NodeValue): Node | null => {
  let current = isOxcNode(node) ? node : null;

  while (current !== null) {
    if (current.type === 'ParenthesizedExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    if (current.type === 'ChainExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    break;
  }

  return current;
};

const evalStaticTruthiness = (node: NodeValue): boolean | null => {
  const n = unwrapExpression(node);

  if (n === null) {
    return null;
  }

  if (n.type === 'Literal') {
    const value = n.value;

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'bigint') {
      return value !== 0n;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    if (value === null) {
      return false;
    }

    return null;
  }

  if (n.type === 'UnaryExpression') {
    const operator = typeof n.operator === 'string' ? n.operator : '';
    const argument = n.argument;

    if (operator === 'void') {
      return false;
    }

    if (operator === '!') {
      const inner = evalStaticTruthiness(argument);

      return inner === null ? null : !inner;
    }
  }

  return null;
};

type HandledStatementType =
  | 'BlockStatement'
  | 'LabeledStatement'
  | 'IfStatement'
  | 'WhileStatement'
  | 'DoWhileStatement'
  | 'ForOfStatement'
  | 'ForInStatement'
  | 'ForStatement'
  | 'SwitchStatement'
  | 'BreakStatement'
  | 'ContinueStatement'
  | 'ReturnStatement'
  | 'ThrowStatement'
  | 'TryStatement';

const handledStatementTypes = new Set<string>([
  'BlockStatement',
  'LabeledStatement',
  'IfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ForOfStatement',
  'ForInStatement',
  'ForStatement',
  'SwitchStatement',
  'BreakStatement',
  'ContinueStatement',
  'ReturnStatement',
  'ThrowStatement',
  'TryStatement',
]);

const isHandledStatementType = (value: string): value is HandledStatementType => handledStatementTypes.has(value);

export class OxcCFGBuilder {
  private cfg: IntegerCFG;
  private nodePayloads: Array<CfgNodePayload | null>;
  private exitId: NodeId;
  private finallyReturnEntryStack: NodeId[];

  constructor() {
    this.cfg = new IntegerCFG();
    this.nodePayloads = [];
    this.exitId = 0;
    this.finallyReturnEntryStack = [];
  }

  public buildFunctionBody(bodyNode: Node | ReadonlyArray<Node> | undefined): OxcBuiltFunctionCfg {
    this.cfg = new IntegerCFG();
    this.nodePayloads = [];
    this.finallyReturnEntryStack = [];

    const entryId = this.addNode(null);

    this.exitId = this.addNode(null);

    const tails = this.visitStatement(bodyNode, [entryId], [], null);

    for (const tail of tails) {
      this.cfg.addEdge(tail, this.exitId, EdgeType.Normal);
    }

    return {
      cfg: this.cfg,
      entryId,
      exitId: this.exitId,
      nodePayloads: this.nodePayloads,
    };
  }

  private addNode(payload: CfgNodePayload | null): NodeId {
    const nodeId = this.cfg.addNode();

    this.nodePayloads[nodeId] = payload;

    return nodeId;
  }

  private connect(fromNodes: readonly NodeId[], to: NodeId, type: EdgeType = EdgeType.Normal): void {
    for (const from of fromNodes) {
      this.cfg.addEdge(from, to, type);
    }
  }

  private visitStatement(
    node: Node | ReadonlyArray<Node> | undefined,
    incoming: readonly NodeId[],
    loopStack: readonly LoopTargets[],
    currentLabel: string | null,
  ): NodeId[] {
    if (isOxcNodeArray(node)) {
      let tails: NodeId[] = [...incoming];

      for (const entry of node) {
        tails = this.visitStatement(entry, tails, loopStack, null);
      }

      return tails;
    }

    if (!isOxcNode(node)) {
      return [...incoming];
    }

    if (!isHandledStatementType(node.type)) {
      const statementNode = this.addNode(node);

      this.connect(incoming, statementNode, EdgeType.Normal);

      return [statementNode];
    }

    switch (node.type) {
      case 'BlockStatement': {
        let tails: NodeId[] = [...incoming];
        const bodyItems = (node.body ?? []) as ReadonlyArray<Node>;

        for (const child of bodyItems) {
          tails = this.visitStatement(child, tails, loopStack, null);
        }

        return tails;
      }

      case 'LabeledStatement': {
        const labelNode = node.label;
        const labelName = getNodeName(labelNode);
        const bodyValue = node.body;

        return this.visitStatement(bodyValue, incoming, loopStack, labelName);
      }

      case 'IfStatement': {
        const testValue = node.test;
        const conditionNode = this.addNode(testValue ?? null);
        const truthiness = evalStaticTruthiness(testValue);

        this.connect(incoming, conditionNode, EdgeType.Normal);

        const trueEntry = this.addNode(null);
        const falseEntry = this.addNode(null);
        const consequentValue = node.consequent;
        const alternateValue = node.alternate;

        if (truthiness === true) {
          this.cfg.addEdge(conditionNode, trueEntry, EdgeType.True);

          const trueTails = this.visitStatement(consequentValue, [trueEntry], loopStack, null);
          const mergeNode = this.addNode(null);

          this.connect(trueTails, mergeNode, EdgeType.Normal);

          return [mergeNode];
        }

        if (truthiness === false) {
          this.cfg.addEdge(conditionNode, falseEntry, EdgeType.False);

          const falseTails = alternateValue ? this.visitStatement(alternateValue, [falseEntry], loopStack, null) : [falseEntry];
          const mergeNode = this.addNode(null);

          this.connect(falseTails, mergeNode, EdgeType.Normal);

          return [mergeNode];
        }

        this.cfg.addEdge(conditionNode, trueEntry, EdgeType.True);
        this.cfg.addEdge(conditionNode, falseEntry, EdgeType.False);

        const trueTails = this.visitStatement(consequentValue, [trueEntry], loopStack, null);
        const falseTails = alternateValue ? this.visitStatement(alternateValue, [falseEntry], loopStack, null) : [falseEntry];
        const mergeNode = this.addNode(null);

        this.connect(trueTails, mergeNode, EdgeType.Normal);
        this.connect(falseTails, mergeNode, EdgeType.Normal);

        return [mergeNode];
      }

      case 'WhileStatement': {
        const testValue = node.test;
        const conditionNode = this.addNode(testValue ?? null);
        const truthiness = evalStaticTruthiness(testValue);

        this.connect(incoming, conditionNode, EdgeType.Normal);

        const bodyEntry = this.addNode(null);
        const afterLoop = this.addNode(null);

        if (truthiness === true) {
          this.cfg.addEdge(conditionNode, bodyEntry, EdgeType.True);
        } else if (truthiness === false) {
          this.cfg.addEdge(conditionNode, afterLoop, EdgeType.False);
        } else {
          this.cfg.addEdge(conditionNode, bodyEntry, EdgeType.True);
          this.cfg.addEdge(conditionNode, afterLoop, EdgeType.False);
        }

        if (truthiness === false) {
          return [afterLoop];
        }

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterLoop, continueTarget: conditionNode, label: currentLabel },
        ];
        const bodyValue = node.body;
        const bodyTails = this.visitStatement(bodyValue, [bodyEntry], nextLoopStack, null);

        this.connect(bodyTails, conditionNode, EdgeType.Normal);

        return [afterLoop];
      }

      case 'DoWhileStatement': {
        const bodyEntry = this.addNode(null);
        const testValue = node.test;
        const conditionNode = this.addNode(testValue ?? null);
        const afterLoop = this.addNode(null);

        this.connect(incoming, bodyEntry, EdgeType.Normal);

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterLoop, continueTarget: conditionNode, label: currentLabel },
        ];
        const bodyValue = node.body;
        const bodyTails = this.visitStatement(bodyValue, [bodyEntry], nextLoopStack, null);

        this.connect(bodyTails, conditionNode, EdgeType.Normal);

        this.cfg.addEdge(conditionNode, bodyEntry, EdgeType.True);
        this.cfg.addEdge(conditionNode, afterLoop, EdgeType.False);

        return [afterLoop];
      }

      case 'ForOfStatement':
      case 'ForInStatement': {
        // Model as: header -> body -> header, with an explicit exit edge.
        // IMPORTANT: keep the header payload free of `body` so that uses in the body
        // are not attributed to the same CFG node as the loop variable write.
        const headerPayload: Node[] = [];
        const leftValue = node.left;
        const rightValue = node.right;

        if (isOxcNode(leftValue)) {
          headerPayload.push(leftValue);
        }

        if (isOxcNode(rightValue)) {
          headerPayload.push(rightValue);
        }

        const headerNode = this.addNode(headerPayload.length > 0 ? headerPayload : null);
        const bodyEntry = this.addNode(null);
        const afterLoop = this.addNode(null);

        this.connect(incoming, headerNode, EdgeType.Normal);

        // The loop may execute 0 times; keep a direct exit edge.
        this.cfg.addEdge(headerNode, afterLoop, EdgeType.Normal);
        this.cfg.addEdge(headerNode, bodyEntry, EdgeType.Normal);

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterLoop, continueTarget: headerNode, label: currentLabel },
        ];
        const bodyValue = node.body;
        const bodyTails = this.visitStatement(bodyValue, [bodyEntry], nextLoopStack, null);

        this.connect(bodyTails, headerNode, EdgeType.Normal);

        return [afterLoop];
      }

      case 'ForStatement': {
        let tails: NodeId[] = [...incoming];
        const initValue = node.init;
        const testValue = node.test;
        const updateValue = node.update;

        if (initValue !== undefined && initValue !== null) {
          const initNode = this.addNode(initValue);

          this.connect(tails, initNode, EdgeType.Normal);

          tails = [initNode];
        }

        const testNode = this.addNode(testValue ?? null);
        const truthiness = evalStaticTruthiness(testValue);

        this.connect(tails, testNode, EdgeType.Normal);

        const bodyEntry = this.addNode(null);
        const afterLoop = this.addNode(null);

        if (truthiness === true || testValue === undefined) {
          this.cfg.addEdge(testNode, bodyEntry, EdgeType.True);
        } else if (truthiness === false) {
          this.cfg.addEdge(testNode, afterLoop, EdgeType.False);
        } else {
          this.cfg.addEdge(testNode, bodyEntry, EdgeType.True);
          this.cfg.addEdge(testNode, afterLoop, EdgeType.False);
        }

        let continueTarget = testNode;
        let updateNode: NodeId | null = null;

        if (updateValue !== undefined && updateValue !== null) {
          updateNode = this.addNode(updateValue);
          continueTarget = updateNode;
        }

        if (truthiness === false) {
          return [afterLoop];
        }

        const nextLoopStack: LoopTargets[] = [...loopStack, { breakTarget: afterLoop, continueTarget, label: currentLabel }];
        const bodyValue = node.body;
        const bodyTails = this.visitStatement(bodyValue, [bodyEntry], nextLoopStack, null);

        if (updateNode !== null) {
          this.connect(bodyTails, updateNode, EdgeType.Normal);
          this.cfg.addEdge(updateNode, testNode, EdgeType.Normal);
        } else {
          this.connect(bodyTails, testNode, EdgeType.Normal);
        }

        return [afterLoop];
      }

      case 'SwitchStatement': {
        const discriminantNode = this.addNode(node.discriminant ?? null);

        this.connect(incoming, discriminantNode, EdgeType.Normal);

        const afterSwitch = this.addNode(null);
        const cases = node.cases ?? [];
        const caseEntries: NodeId[] = cases.map(() => this.addNode(null));

        for (const entry of caseEntries) {
          this.cfg.addEdge(discriminantNode, entry, EdgeType.Normal);
        }

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterSwitch, continueTarget: afterSwitch, label: currentLabel },
        ];

        for (let index = 0; index < cases.length; index += 1) {
          const caseNode = cases[index];
          const caseEntry = caseEntries[index];

          if (caseNode === undefined) {
            continue;
          }

          if (caseEntry === undefined) {
            continue;
          }

          const consequent = caseNode.consequent ?? [];
          const caseTails = this.visitStatement(consequent, [caseEntry], nextLoopStack, null);
          // Note: switch `case` test expressions are not modeled as nodes.
          const nextEntry = index + 1 < caseEntries.length ? caseEntries[index + 1] : undefined;

          if (nextEntry !== undefined) {
            this.connect(caseTails, nextEntry, EdgeType.Normal);
          } else {
            this.connect(caseTails, afterSwitch, EdgeType.Normal);
          }
        }

        return [afterSwitch];
      }

      case 'BreakStatement': {
        const breakNode = this.addNode(node);

        this.connect(incoming, breakNode, EdgeType.Normal);

        const labelNode = node.label;
        const targetLabel = getNodeName(labelNode);
        const target = this.findBreakTarget(loopStack, targetLabel);

        if (target !== null) {
          this.cfg.addEdge(breakNode, target, EdgeType.Normal);
        }

        return [];
      }

      case 'ContinueStatement': {
        const continueNode = this.addNode(node);

        this.connect(incoming, continueNode, EdgeType.Normal);

        const labelNode = node.label;
        const targetLabel = getNodeName(labelNode);
        const target = this.findContinueTarget(loopStack, targetLabel);

        if (target !== null) {
          this.cfg.addEdge(continueNode, target, EdgeType.Normal);
        }

        return [];
      }

      case 'ReturnStatement': {
        const returnNode = this.addNode(node.argument ?? node);

        this.connect(incoming, returnNode, EdgeType.Normal);

        const finallyReturnEntry = this.finallyReturnEntryStack[this.finallyReturnEntryStack.length - 1] ?? null;

        if (finallyReturnEntry !== null) {
          this.cfg.addEdge(returnNode, finallyReturnEntry, EdgeType.Normal);
        } else {
          this.cfg.addEdge(returnNode, this.exitId, EdgeType.Normal);
        }

        return [];
      }

      case 'ThrowStatement': {
        const throwNode = this.addNode(node.argument ?? node);

        this.connect(incoming, throwNode, EdgeType.Normal);
        this.cfg.addEdge(throwNode, this.exitId, EdgeType.Exception);

        return [];
      }

      case 'TryStatement': {
        const hasFinalizer = Boolean(node.finalizer);
        const finallyEntryNormal = hasFinalizer ? this.addNode(null) : null;
        const finallyEntryReturn = hasFinalizer ? this.addNode(null) : null;

        if (finallyEntryReturn !== null) {
          this.finallyReturnEntryStack.push(finallyEntryReturn);
        }

        const tryEntry = this.addNode(null);

        this.connect(incoming, tryEntry, EdgeType.Normal);

        const tryBlockEntry = this.addNode(null);

        this.cfg.addEdge(tryEntry, tryBlockEntry, EdgeType.Normal);

        const tryTails = this.visitStatement(node.block, [tryBlockEntry], loopStack, null);
        let catchTails: NodeId[] = [];

        if (node.handler) {
          const catchEntry = this.addNode(null);

          this.cfg.addEdge(tryEntry, catchEntry, EdgeType.Exception);

          const handlerBody = node.handler.body;

          catchTails = this.visitStatement(handlerBody, [catchEntry], loopStack, null);
        }

        if (node.finalizer && finallyEntryNormal !== null && finallyEntryReturn !== null) {
          // Normal completion path.
          this.connect(tryTails, finallyEntryNormal, EdgeType.Normal);
          this.connect(catchTails, finallyEntryNormal, EdgeType.Normal);

          const finallyTails = this.visitStatement(node.finalizer, [finallyEntryNormal], loopStack, null);
          // Return completion path: run finalizer and then exit.
          const finallyReturnTails = this.visitStatement(node.finalizer, [finallyEntryReturn], loopStack, null);

          for (const tail of finallyReturnTails) {
            this.cfg.addEdge(tail, this.exitId, EdgeType.Normal);
          }

          this.finallyReturnEntryStack.pop();

          return finallyTails;
        }

        if (finallyEntryReturn !== null) {
          this.finallyReturnEntryStack.pop();
        }

        return [...tryTails, ...catchTails];
      }

      default: {
        return [...incoming];
      }
    }
  }

  private findBreakTarget(loopStack: readonly LoopTargets[], label: string | null): NodeId | null {
    for (let index = loopStack.length - 1; index >= 0; index -= 1) {
      const entry = loopStack[index];

      if (!entry) {
        continue;
      }

      if (label === null) {
        return entry.breakTarget;
      }

      if (entry.label === label) {
        return entry.breakTarget;
      }
    }

    return null;
  }

  private findContinueTarget(loopStack: readonly LoopTargets[], label: string | null): NodeId | null {
    for (let index = loopStack.length - 1; index >= 0; index -= 1) {
      const entry = loopStack[index];

      if (!entry) {
        continue;
      }

      if (label === null) {
        return entry.continueTarget;
      }

      if (entry.label === label) {
        return entry.continueTarget;
      }
    }

    return null;
  }
}
