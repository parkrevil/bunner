import type { ProcessorContext } from '../context';

export function collapseSlashes(ctx: ProcessorContext): void {
  const result: string[] = [];
  for (let i = 0; i < ctx.segments.length; i++) {
    if (ctx.segments[i] !== '') {
      result.push(ctx.segments[i]!);
    }
  }
  ctx.segments = result;
}

export function handleTrailingSlashOptions(ctx: ProcessorContext): void {
  // If ignoreTrailingSlash is true AND we didn't collapse slashes (because that removes empty anyway),
  // we check if last segment is empty.
  // Note: This logic depends on configuration.
  if (ctx.config.ignoreTrailingSlash && ctx.segments.length > 0 && ctx.segments[ctx.segments.length - 1] === '') {
    ctx.segments.pop();
  }
}
