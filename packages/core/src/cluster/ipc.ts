import type { RPCMessage, RPCResponse, RpcPending } from './interfaces';
import type { Promisified, RpcArgs, RpcCallable } from './types';

export function expose<T extends Record<string, RpcCallable>>(obj: T): void {
  const self = globalThis as Worker;

  self.addEventListener('message', (event: MessageEvent) => {
    void (async () => {
      const data = event.data as RPCMessage;

      if (!data?.id || !data.method) {
        return;
      }

      try {
        const fn = obj[data.method as keyof T];

        if (typeof fn !== 'function') {
          throw new Error(`Method ${data.method} not found`);
        }

        const result = await fn(...(data.args || []));

        self.postMessage({ id: data.id, result } as RPCResponse);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        self.postMessage({ id: data.id, error: message } as RPCResponse);
      }
    })();
  });
}

export function wrap<T extends Record<string, RpcCallable>>(
  worker: Worker,
  methods: ReadonlyArray<keyof T>,
): Promisified<T> {
  const pending = new Map<string, RpcPending>();

  worker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as RPCResponse;

    if (!data?.id) {
      return;
    }

    const promise = pending.get(data.id);

    if (promise) {
      if (data.error) {
        promise.reject(new Error(data.error));
      } else {
        promise.resolve(data.result);
      }

      pending.delete(data.id);
    }
  });

  const api: Partial<Promisified<T>> = {};

  for (const method of methods) {
    api[method] = (async (...args: RpcArgs) => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();

        pending.set(id, { resolve, reject });
        worker.postMessage({ id, method: String(method), args } as RPCMessage);
      });
    }) as Promisified<T>[typeof method];
  }

  return api as Promisified<T>;
}
