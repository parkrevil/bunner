import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { RequestIdOptions } from './interfaces';
import type { GenerateId } from './types';

export function requestId(options: RequestIdOptions = {}): Middleware {
  const header = (options.header || HeaderField.RequestId).toLowerCase();
  const generate: GenerateId = options.generator || Bun.randomUUIDv7;
  const trustHeader = options.trustHeader !== false;
  const setHeader = options.setHeader !== false;
  const varyToken = options.header || HeaderField.RequestId;

  return (req, res) => {
    const inbound = trustHeader ? (req.headers.get(header) || req.headers.get(HeaderField.RequestId)) : undefined;
    const id = inbound || generate();

    req.setCustomData('requestId', id);

    if (setHeader) {
      const prevVary = res.getHeader(HeaderField.Vary) as string | null | undefined;
      const nextVary = mergeVary(prevVary, varyToken);

      res.setHeader(HeaderField.RequestId, id);
      res.setHeader(HeaderField.Vary, nextVary);
    }
  };
}

function mergeVary(prev: string | null | undefined, name: string) {
  if (!prev || prev.trim().length === 0) {
    return name;
  }

  if (prev.trim() === '*') {
    return prev;
  }

  const parts = prev.split(',').map((s) => s.trim());
  const lower = parts.map((s) => s.toLowerCase());

  if (!lower.includes(name.toLowerCase())) {
    parts.push(name);
  }

  return parts.join(', ');
}
