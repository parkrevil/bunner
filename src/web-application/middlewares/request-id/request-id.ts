import { HeaderField } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { RequestIdOptions } from './interfaces';
import type { GenerateId } from './types';

export function requestId(options: RequestIdOptions = {}): Middleware {
  const header = (options.header || HeaderField.RequestId).toLowerCase();
  const generate: GenerateId = options.generator || Bun.randomUUIDv7;
  const trustHeader = options.trustHeader !== false;
  const setHeader = options.setHeader !== false;

  return (req, res) => {
    const inbound = trustHeader ? (req.headers.get(header) || req.headers.get(HeaderField.RequestId)) : undefined;
    const id = inbound || generate();

    req.setCustomData('requestId', id);

    if (setHeader) {
      res.setHeader(HeaderField.RequestId, id);
    }
  };
}


