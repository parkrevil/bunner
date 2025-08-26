import type { ClassType } from '../../../types';
import type { ProviderScope } from './provider-scope';
import type { ServiceIdentifier } from './service-identifier';

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


