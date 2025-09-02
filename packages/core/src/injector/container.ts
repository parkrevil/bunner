import type { BunnerRootModule } from '../interfaces';
import type { Class } from '../types';
import { MetadataKey } from './constants';
import type { DependencyGraphNode, ModuleMetadata } from './types';

/**
 * Container
 * @description Dependency injection container for each application
 */
export class Container {
  private rootModuleCls: Class<BunnerRootModule>;
  private graph: Map<Class, DependencyGraphNode>;

  constructor(rootModuleCls: Class<BunnerRootModule>) {
    this.rootModuleCls = rootModuleCls;
    this.graph = new Map<Class, DependencyGraphNode>();
  }

  /**
   * Initialize the container and build dependency graph
   */
  async init() {
    console.log('🔧 Building dependency graph...');
    
    this.buildGraph();

    console.log(this.graph);
    
    console.log('✅ Dependency graph built and resolved');
  }

  /**
   * Build the dependency graph
   */
  private async buildGraph() {
    this.exploreModule(this.rootModuleCls);
  }
  
  /**
   * Explore the module
   * @param cls 
   * @returns 
   */
  private exploreModule(cls: Class) {
    if (this.graph.has(cls)) {
      return;
    }

    const metadata: ModuleMetadata = Reflect.getMetadata(MetadataKey.Module, cls);

    if (!metadata) {
      throw new Error(`Module ${cls.name} does not have a @Module() decorator.`);
    }

    this.graph.set(cls, metadata);

    for (const importedCls of metadata.imports) {
      this.exploreModule(importedCls);
    }
  }
}
