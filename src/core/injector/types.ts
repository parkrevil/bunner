import type { ClassType } from '../../types';

export type ProviderScope = 'Singleton' | 'Transient' | 'Request';

export type ServiceIdentifier<T = any> = ClassType<T> | symbol | string;

export type ProviderDescriptor =
  | ClassType
  | {
    provide: ServiceIdentifier;
    useClass?: ClassType;
    useValue?: any;
    useFactory?: (...args: any[]) => any | Promise<any>;
    inject?: ServiceIdentifier[];
    scope?: ProviderScope;
  };
