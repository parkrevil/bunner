import { AsyncLocalStorage } from 'async_hooks';
import type { Container as InversifyContainer } from 'inversify';

const als = new AsyncLocalStorage<InversifyContainer>();

export const RequestContext = {
  runWithContainer<T>(container: InversifyContainer, fn: () => T): T {
    return als.run(container, fn);
  },

  getCurrentContainer(): InversifyContainer | undefined {
    return als.getStore();
  },
};
