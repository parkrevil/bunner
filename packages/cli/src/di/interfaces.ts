export interface ModuleDecoratorMetadata {
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
}

export interface ModuleMetadata extends ModuleDecoratorMetadata {
  className: string;
}

export interface ControllerMetadata extends ClassMetadata {
  path: string;
  methods: MethodMetadata[];
}

export interface ParamMetadata {
  decoratorName: string;
  decoratorArgs: any[];
  paramName: string;
  paramType: string;
}

export interface MethodMetadata {
  decoratorName: string;
  decoratorArgs: any[];
  methodName: string;
  parameters: ParamMetadata[];
}

export interface ClassDependency {
  dependencyName: string;
  dependencyType: string;
}

export interface ClassMetadata {
  className: string;
  dependencies: ClassDependency[];
}

export interface DiConfig {
  providers: ClassMetadata[];
  controllers: ControllerMetadata[];
  modules: ModuleMetadata[];
}
