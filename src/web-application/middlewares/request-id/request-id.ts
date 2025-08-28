import crypto from 'crypto';
import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { RequestIdOptions } from './interfaces';
import type { GenerateId } from './types';

export function requestId(options: RequestIdOptions = {}): Middleware {
  const header = (options.header || HeaderField.RequestId).toLowerCase();
  const generate: GenerateId = options.generator || crypto.randomUUID;
  const trustHeader = options.trustHeader !== false;
  const setHeader = options.setHeader !== false;
  const varyToken = options.header || HeaderField.RequestId;

  return (req, res) => {
    const inbound = trustHeader ? (req.headers.get(header) || req.headers.get(HeaderField.RequestId)) : undefined;
    const id = inbound || generate();

    req.setCustomData('requestId', id);

    if (setHeader) {
      const prevVary = res.getHeader(HeaderField.Vary) as string | null | undefined;
      let nextVary: string;

      if (!prevVary || prevVary.trim().length === 0) {
        nextVary = varyToken;
      } else if (prevVary.trim() === '*') {
        nextVary = prevVary;
      } else {
        const parts = prevVary.split(',').map((s) => s.trim());
        const lower = parts.map((s) => s.toLowerCase());

        if (!lower.includes(varyToken.toLowerCase())) {
          parts.push(varyToken);
        }

        nextVary = parts.join(', ');
      }

      res.setHeader(HeaderField.RequestId, id);
      res.setHeader(HeaderField.Vary, nextVary);
    }
  };
}
