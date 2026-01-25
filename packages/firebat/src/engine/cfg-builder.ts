import { EdgeType, IntegerCFG, type NodeId } from './cfg';

const unwrapExpression = (node: any): any => {
  let current = node;

  while (current && typeof current === 'object') {
    if (current.type === 'ParenthesizedExpression') {
      current = current.expression;

      continue;
    }

    if (current.type === 'ChainExpression') {
      current = current.expression;

      continue;
    }

    break;
  }

  return current;
};

const evalStaticTruthiness = (node: any): boolean | null => {
  const n = unwrapExpression(node);

  if (!n || typeof n !== 'object') {
    return null;
  }

  if (n.type === 'Literal') {
    const value = n.value as unknown;

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
    const operator = typeof n.operator === 'string' ? (n.operator as string) : '';
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

export interface OxcBuiltFunctionCfg {
  readonly cfg: IntegerCFG;
  readonly entryId: NodeId;
  readonly exitId: NodeId;
  readonly nodePayloads: ReadonlyArray<unknown | null>;
}

interface LoopTargets {
  readonly breakTarget: NodeId;
  readonly continueTarget: NodeId;
  readonly label: string | null;
}

export class OxcCFGBuilder {
  private cfg: IntegerCFG;
  private nodePayloads: Array<unknown | null>;
  private exitId: NodeId;
  private finallyReturnEntryStack: NodeId[];

  constructor() {
    this.cfg = new IntegerCFG();
    this.nodePayloads = [];
    this.exitId = 0;
    this.finallyReturnEntryStack = [];
  }

  public buildFunctionBody(bodyNode: unknown): OxcBuiltFunctionCfg {
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

  private addNode(payload: unknown | null): NodeId {
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
    node: unknown,
    incoming: readonly NodeId[],
    loopStack: readonly LoopTargets[],
    currentLabel: string | null,
  ): NodeId[] {
    if (!node || typeof node !== 'object') {
      return [...incoming];
    }

    const statement = node as any;

    if (Array.isArray(statement)) {
      let tails: NodeId[] = [...incoming];

      for (const entry of statement) {
        tails = this.visitStatement(entry, tails, loopStack, null);
      }

      return tails;
    }

    switch (statement.type) {
      case 'BlockStatement': {
        let tails: NodeId[] = [...incoming];

        for (const child of statement.body ?? []) {
          tails = this.visitStatement(child, tails, loopStack, null);
        }

        return tails;
      }

      case 'LabeledStatement': {
        const labelName = statement.label?.name ?? null;

        return this.visitStatement(statement.body, incoming, loopStack, labelName);
      }

      case 'IfStatement': {
        const conditionNode = this.addNode(statement.test ?? null);
        const truthiness = evalStaticTruthiness(statement.test);

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

        const trueTails = this.visitStatement(statement.consequent, [trueEntry], loopStack, null);
        const falseTails = statement.alternate
          ? this.visitStatement(statement.alternate, [falseEntry], loopStack, null)
          : [falseEntry];
        const mergeNode = this.addNode(null);

        this.connect(trueTails, mergeNode, EdgeType.Normal);
        this.connect(falseTails, mergeNode, EdgeType.Normal);

        return [mergeNode];
      }

      case 'WhileStatement': {
        const conditionNode = this.addNode(statement.test ?? null);
        const truthiness = evalStaticTruthiness(statement.test);

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
        const bodyTails = this.visitStatement(statement.body, [bodyEntry], nextLoopStack, null);

        this.connect(bodyTails, conditionNode, EdgeType.Normal);

        return [afterLoop];
      }

      case 'DoWhileStatement': {
        const bodyEntry = this.addNode(null);
        const conditionNode = this.addNode(statement.test ?? null);
        const afterLoop = this.addNode(null);

        this.connect(incoming, bodyEntry, EdgeType.Normal);

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterLoop, continueTarget: conditionNode, label: currentLabel },
        ];
        const bodyTails = this.visitStatement(statement.body, [bodyEntry], nextLoopStack, null);

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
        const headerPayload = {
          type: statement.type === 'ForInStatement' ? 'ForInHeader' : 'ForOfHeader',
          left: statement.left ?? null,
          right: statement.right ?? null,
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
        const bodyTails = this.visitStatement(statement.body, [bodyEntry], nextLoopStack, null);

        this.connect(bodyTails, headerNode, EdgeType.Normal);

        return [afterLoop];
      }

      case 'ForStatement': {
        let tails: NodeId[] = [...incoming];

        if (statement.init) {
          const initNode = this.addNode(statement.init);

          this.connect(tails, initNode, EdgeType.Normal);

          tails = [initNode];
        }

        const testNode = this.addNode(statement.test ?? null);
        const truthiness = evalStaticTruthiness(statement.test);

        this.connect(tails, testNode, EdgeType.Normal);

        const bodyEntry = this.addNode(null);
        const afterLoop = this.addNode(null);

        if (truthiness === true || statement.test === undefined) {
          this.cfg.addEdge(testNode, bodyEntry, EdgeType.True);
        } else if (truthiness === false) {
          this.cfg.addEdge(testNode, afterLoop, EdgeType.False);
        } else {
          this.cfg.addEdge(testNode, bodyEntry, EdgeType.True);
          this.cfg.addEdge(testNode, afterLoop, EdgeType.False);
        }

        let continueTarget = testNode;
        let updateNode: NodeId | null = null;

        if (statement.update) {
          updateNode = this.addNode(statement.update);
          continueTarget = updateNode;
        }

        const nextLoopStack: LoopTargets[] = [...loopStack, { breakTarget: afterLoop, continueTarget, label: currentLabel }];
        const bodyTails = this.visitStatement(statement.body, [bodyEntry], nextLoopStack, null);

        if (updateNode) {
          this.connect(bodyTails, updateNode, EdgeType.Normal);
          this.cfg.addEdge(updateNode, testNode, EdgeType.Normal);
        } else {
          this.connect(bodyTails, testNode, EdgeType.Normal);
        }

        return [afterLoop];
      }

      case 'SwitchStatement': {
        const discriminantNode = this.addNode(statement.discriminant ?? null);

        this.connect(incoming, discriminantNode, EdgeType.Normal);

        const afterSwitch = this.addNode(null);
        const cases: unknown[] = Array.isArray(statement.cases) ? statement.cases : [];
        const caseEntries: NodeId[] = cases.map(() => this.addNode(null));

        for (const entry of caseEntries) {
          this.cfg.addEdge(discriminantNode, entry, EdgeType.Normal);
        }

        const nextLoopStack: LoopTargets[] = [
          ...loopStack,
          { breakTarget: afterSwitch, continueTarget: afterSwitch, label: currentLabel },
        ];

        for (let index = 0; index < cases.length; index += 1) {
          const caseNode = cases[index] as any;
          const caseEntry = caseEntries[index]!;
          const consequent = Array.isArray(caseNode.consequent) ? caseNode.consequent : [];
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
        const breakNode = this.addNode(statement);

        this.connect(incoming, breakNode, EdgeType.Normal);

        const targetLabel = statement.label?.name ?? null;
        const target = this.findBreakTarget(loopStack, targetLabel);

        if (target !== null) {
          this.cfg.addEdge(breakNode, target, EdgeType.Normal);
        }

        return [];
      }

      case 'ContinueStatement': {
        const continueNode = this.addNode(statement);

        this.connect(incoming, continueNode, EdgeType.Normal);

        const targetLabel = statement.label?.name ?? null;
        const target = this.findContinueTarget(loopStack, targetLabel);

        if (target !== null) {
          this.cfg.addEdge(continueNode, target, EdgeType.Normal);
        }

        return [];
      }

      case 'ReturnStatement': {
        const returnNode = this.addNode(statement.argument ?? statement);

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
        const throwNode = this.addNode(statement.argument ?? statement);

        this.connect(incoming, throwNode, EdgeType.Normal);
        this.cfg.addEdge(throwNode, this.exitId, EdgeType.Exception);

        return [];
      }

      case 'TryStatement': {
        const hasFinalizer = Boolean(statement.finalizer);
        const finallyEntryNormal = hasFinalizer ? this.addNode(null) : null;
        const finallyEntryReturn = hasFinalizer ? this.addNode(null) : null;

        if (finallyEntryReturn !== null) {
          this.finallyReturnEntryStack.push(finallyEntryReturn);
        }

        const tryEntry = this.addNode(null);

        this.connect(incoming, tryEntry, EdgeType.Normal);

        const tryBlockEntry = this.addNode(null);

        this.cfg.addEdge(tryEntry, tryBlockEntry, EdgeType.Normal);

        const tryTails = this.visitStatement(statement.block, [tryBlockEntry], loopStack, null);
        let catchTails: NodeId[] = [];

        if (statement.handler) {
          const catchEntry = this.addNode(null);

          this.cfg.addEdge(tryEntry, catchEntry, EdgeType.Exception);

          catchTails = this.visitStatement(statement.handler.body, [catchEntry], loopStack, null);
        }

        if (statement.finalizer && finallyEntryNormal !== null && finallyEntryReturn !== null) {
          // Normal completion path.
          this.connect(tryTails, finallyEntryNormal, EdgeType.Normal);
          this.connect(catchTails, finallyEntryNormal, EdgeType.Normal);

          const finallyTails = this.visitStatement(statement.finalizer, [finallyEntryNormal], loopStack, null);
          // Return completion path: run finalizer and then exit.
          const finallyReturnTails = this.visitStatement(statement.finalizer, [finallyEntryReturn], loopStack, null);

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
        const statementNode = this.addNode(statement);

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
