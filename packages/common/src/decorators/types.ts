import type { ModuleMarkers } from '../types';

export type InjectableScope = 'singleton' | 'request' | 'transient';

export type InjectableVisibility = 'all' | 'module' | ModuleMarkers;
