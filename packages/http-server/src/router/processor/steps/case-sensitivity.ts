import type { ProcessorContext } from '../context';

export function toLowerCase(ctx: ProcessorContext): void {

  for (let i = 0; i < ctx.segments.length; i++) {
    ctx.segments[i] = ctx.segments[i]!.toLowerCase();
  }
}