import type { ProcessorContext } from '../context';

export function toLowerCase(ctx: ProcessorContext): void {
  // Original logic: if (config.caseSensitive === false)
  // We assume this step is only added if needed, or we check config here?
  // Pipeline optimization: only add this step if needed.
  // So we just do the work.
  for (let i = 0; i < ctx.segments.length; i++) {
    ctx.segments[i] = ctx.segments[i]!.toLowerCase();
  }
}
