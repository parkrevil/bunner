export interface RPCMessage {
  id: string;
  method: string;
  args: any[];
}

export interface RPCResponse {
  id: string;
  result?: any;
  error?: any;
}

export function expose(obj: any) {
  const self = globalThis as unknown as Worker;

  self.addEventListener('message', (event: MessageEvent) => {
    void (async () => {
      const data = event.data as RPCMessage;
      if (!data || !data.id || !data.method) {
        return;
      }

      try {
        const fn = obj[data.method];
        if (typeof fn !== 'function') {
          throw new Error(`Method ${data.method} not found`);
        }

        const result = await fn(...(data.args || []));
        self.postMessage({ id: data.id, result } as RPCResponse);
      } catch (err: any) {
        self.postMessage({ id: data.id, error: err.message || 'Unknown error' } as RPCResponse);
      }
    })();
  });
}

export type Promisified<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => any ? (...args: A) => Promise<any> : T[K];
};

export function wrap<T extends object>(worker: Worker): Promisified<T> {
  const pending = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  worker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as RPCResponse;
    if (!data || !data.id) {
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

  return new Proxy({} as any, {
    get: (_, prop) => {
      if (prop === 'then') {
        return undefined;
      } // Avoid Promise wrapping confusion

      return (...args: any[]) => {
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, method: prop as string, args } as RPCMessage);
        });
      };
    },
  });
}
