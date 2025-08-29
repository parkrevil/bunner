import { StatusCodes } from 'http-status-codes';
import { HeaderField } from 'src/web-application/constants';
import type { Middleware } from '../../providers/middleware';
import { BunnerRequest } from '../../request';
import { BunnerResponse } from '../../response';
import type { LRUNode, RateLimiterOptions } from './interfaces';


export function rateLimiter(options: RateLimiterOptions = {}): Middleware {
  let head: LRUNode | undefined;
  let tail: LRUNode | undefined;
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 10;
  const capacity = options.capacity ?? 10_000;
  const shouldSetHeaders = options.headers ?? true;
  const statusCode = options.statusCode ?? StatusCodes.TOO_MANY_REQUESTS;
  const cache = new Map<string, LRUNode>();

  const addToHead = (node: LRUNode) => {
    node.prev = undefined;
    node.next = head;

    if (head) {
      head.prev = node;
    }

    head = node;

    if (!tail) {
      tail = node;
    }
  };

  const removeNode = (node: LRUNode) => {
    if (node.prev) {
      node.prev.next = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    if (head === node) {
      head = node.next;
    }

    if (tail === node) {
      tail = node.prev;
    }

    node.prev = node.next = undefined;
  };

  const moveToHead = (node: LRUNode) => {
    if (head === node) {
      return;
    }

    removeNode(node);
    addToHead(node);
  };

  const evictTail = () => {
    if (!tail) {
      return;
    }

    cache.delete(tail.key);

    const oldTail = tail;

    if (head === oldTail && tail === oldTail) {
      head = tail = undefined;
    } else {
      tail = oldTail.prev;

      if (tail) {
        tail.next = undefined;
      } else {
        head = undefined;
      }
    }

    try {
      Atomics.store(oldTail.shared, 0, 0);
      Atomics.store(oldTail.shared, 1, 0);
    } catch {
    }
  };

  return (req: BunnerRequest, res: BunnerResponse) => {
    const nowMs = Date.now();
    const nowSec = (nowMs / 1000) | 0;
    const key = req.ip;

    if (!key) {
      return;
    }

    let node = cache.get(key);

    if (!node) {
      const sab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
      const shared = new Int32Array(sab);
      const expireSec = ((nowMs + windowMs) / 1000) | 0;

      Atomics.store(shared, 0, expireSec);
      Atomics.store(shared, 1, 1);

      node = { key, shared };

      cache.set(key, node);

      addToHead(node);

      if (cache.size > capacity) {
        evictTail();
      }
    } else {
      const expireSec = Atomics.load(node.shared, 0);

      if (expireSec < nowSec) {
        const newExpire = ((nowMs + windowMs) / 1000) | 0;

        Atomics.store(node.shared, 0, newExpire);
        Atomics.store(node.shared, 1, 1);

        moveToHead(node);
      } else {
        Atomics.add(node.shared, 1, 1);

        const newExpire = ((nowMs + windowMs) / 1000) | 0;

        Atomics.store(node.shared, 0, newExpire);

        moveToHead(node);
      }
    }

    const curCount = Atomics.load(node.shared, 1);
    const curExpireSec = Atomics.load(node.shared, 0);
    const remaining = Math.max(0, max - curCount);

    if (shouldSetHeaders) {
      res.setHeaders({
        [HeaderField.XRateLimitLimit]: String(max),
        [HeaderField.XRateLimitRemaining]: String(remaining),
        [HeaderField.XRateLimitReset]: String(curExpireSec),
      });
    }

    if (curCount > max) {
      return res.setStatus(statusCode);
    }
  };
}
