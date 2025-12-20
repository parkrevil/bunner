import { Injectable, Inject } from '@bunner/core';
import { OpenApiFactory } from './spec-factory';
import { ScalarModuleOptions } from './scalar.module';

@Injectable()
export class ScalarService {
  private spec: any;

  constructor(@Inject('SCALAR_OPTIONS') options: ScalarModuleOptions) {
    const registry = (globalThis as any).__BUNNER_METADATA_REGISTRY__;
    if (registry) {
      this.spec = OpenApiFactory.create(registry, {
        title: options.title || 'API Docs',
        version: options.version || '1.0.0'
      });
    } else {
      console.warn('ScalarService: No Metadata Registry found.');
    }
  }

  getSpec() {
    return this.spec;
  }
}