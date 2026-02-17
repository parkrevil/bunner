export interface ToolDefinition<Ctx = unknown, Input = unknown, Output = unknown> {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  shouldRegister?: (ctx: Ctx) => boolean;
  run: (ctx: Ctx, input: Input) => Promise<Output>;
}

export type AnyToolDefinition = ToolDefinition<any, any, any>;

export function declareTool<const T extends AnyToolDefinition>(tool: T): T {
  return tool;
}

export class ToolRegistry {
  private readonly toolsByName = new Map<string, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    if (this.toolsByName.has(tool.name)) {
      throw new Error('Duplicate tool name');
    }

    this.toolsByName.set(tool.name, tool);
  }

  get(name: string): AnyToolDefinition | undefined {
    return this.toolsByName.get(name);
  }

  list(): AnyToolDefinition[] {
    return Array.from(this.toolsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  listForContext(ctx: unknown): AnyToolDefinition[] {
    return this.list().filter((t) => {
      if (typeof t.shouldRegister !== 'function') return true;
      return t.shouldRegister(ctx);
    });
  }
}
