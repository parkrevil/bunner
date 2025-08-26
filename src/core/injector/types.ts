import type { ClassType } from 'src/types';

export type ProviderScope = 'Singleton' | 'Transient' | 'Request';

export type ProviderDescriptor = ClassType | {
  provide: ClassType;
  useClass?: ClassType;
  scope?: ProviderScope;
};
