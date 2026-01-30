import type { ModuleMarkers } from '../types';

export type InjectableScope = 'singleton' | 'request' | 'transient';

export type InjectableVisibleTo = 'all' | 'module' | ModuleMarkers;
