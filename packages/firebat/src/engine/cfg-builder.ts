import { IntegerCFG } from './cfg';

import type { EdgeType, LoopTargets, NodeId, OxcBuiltFunctionCfg, OxcNode, OxcNodeValue } from './types';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getNodeType = (node: OxcNode): string | null => {
  return typeof node.type === 'string' ? node.type : null;
};

const unwrapExpression = (node: OxcNodeValue | undefined): OxcNode | null => {
  let current = isOxcNode(node) ? node : null;

  while (current) {
    const nodeType = getNodeType(current);

    if (nodeType === 'ParenthesizedExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    if (nodeType === 'ChainExpression') {
      const expression = current.expression;

      current = isOxcNode(expression) ? expression : null;

      continue;
    }

    break;
  }

  return current;
};

const evalStaticTruthiness = (node: OxcNodeValue | undefined): boolean | null => {
  const n = unwrapExpression(node);

  if (n === null) {
    return null;
  }

  if (getNodeType(n) === 'Literal') {
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

  if (getNodeType(n) === 'UnaryExpression') {
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

export class OxcCFGBuilder {
  private cfg: IntegerCFG;
  private nodePayloads: Array<OxcNode | null>;
  private exitId: NodeId;
  private finallyReturnEntryStack: NodeId[];

  constructor() {
    this.cfg = new IntegerCFG();
    this.nodePayloads = [];
    this.exitId = 0;
    this.finallyReturnEntryStack = [];
  }

  public buildFunctionBody(bodyNode: OxcNodeValue | undefined): OxcBuiltFunctionCfg {
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

  private addNode(payload: OxcNode | null): NodeId {
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
    node: OxcNodeValue | undefined,
    incoming: readonly NodeId[],
    loopStack: readonly LoopTargets[],
    currentLabel: string | null,
  ): NodeId[] {
    if (Array.isArray(node)) {
      let tails: NodeId[] = [...incoming];

      for (const entry of node) {
        tails = this.visitStatement(entry, tails, loopStack, null);
      }

      return tails;
    }

    if (!isOxcNode(node)) {
      return [...incoming];
    }

    const statementType = getNodeType(node);

    if (statementType === null) {
      return [...incoming];
    }

    switch (statementType) {
      case 'BlockStatement': {
        let tails: NodeId[] = [...incoming];
        const bodyValue = node.body;
        const bodyItems = Array.isArray(bodyValue) ? bodyValue : [];

        for (const child of bodyItems) {
          tails = this.visitStatement(child, tails, loopStack, null);
        }

        return tails;
      }

      case 'LabeledStatement': {
        const labelNode = node.label;
        const labelName = isOxcNode(labelNode) && typeof labelNode.name === 'string' ? labelNode.name : null;
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

        if (truthiness === true) {
          this.cfg.addEdge(conditionNode, trueEntry, EdgeType.True);
        } else if (truthiness === false) {
          this.cfg.addEdge(conditionNode, falseEntry, EdgeType.False);
        } else {
          this.cfg.addEdge(conditionNode, trueEntry, EdgeType.True);
          this.cfg.addEdge(conditionNode, falseEntry, EdgeType.False);
        }

        const consequentValue = node.consequent;
        const alternateValue = node.alternate;
        const trueTails = this.visitStatement(consequentValue, [trueEntry], loopStack, null);
        const falseTails = alternateValue
          ? this.visitStatement(alternateValue, [falseEntry], loopStack, null)
          : [falseEntry];
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
        const headerPayload: OxcNode = {
          type: statementType === 'ForInStatement' ? 'ForInHeader' : 'ForOfHeader',
          left: node.left ?? null,
          right: node.right ?? null,
        };
        const headerNode = this.addNode(headerPayload);
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

        if (initValue) {
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

        if (updateValue) {
          updateNode = this.addNode(updateValue);
          continueTarget = updateNode;
        }

        const nextLoopStack: LoopTargets[] = [...loopStack, { breakTarget: afterLoop, continueTarget, label: currentLabel }];
        const bodyValue = node.body;
        const bodyTails = this.visitStatement(bodyValue, [bodyEntry], nextLoopStack, null);

        if (updateNode) {
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
        const cases = Array.isArray(node.cases) ? node.cases : [];
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
          const caseEntry = caseEntries[index]!;
          const consequentValue = isOxcNode(caseNode) ? caseNode.consequent : undefined;
          const consequent = Array.isArray(consequentValue) ? consequentValue : [];
          const caseTails = this.visitStatement(consequent, [caseEntry], nextLoopStack, null);
          // Note: switch `case` test expressions are not modeled as nodes.
          const nextEntry = index + 1 < caseEntries.length ? caseEntries[index + 1]! : null;

          if (nextEntry) {
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
        const targetLabel = isOxcNode(labelNode) && typeof labelNode.name === 'string' ? labelNode.name : null;
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
        const targetLabel = isOxcNode(labelNode) && typeof labelNode.name === 'string' ? labelNode.name : null;
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
        const statementNode = this.addNode(node);

        this.connect(incoming, statementNode, EdgeType.Normal);

        return [statementNode];
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
