import {
  ClassDeclaration,
  Project,
  Decorator,
  ObjectLiteralExpression,
  SyntaxKind,
  PropertyAssignment,
  MethodDeclaration,
} from 'ts-morph';
import * as path from 'path';
import type { Command } from '../interfaces';
import type { DiConfig, ClassDependency, ClassMetadata, ControllerMetadata, MethodMetadata, ParamMetadata, ModuleDecoratorMetadata } from './interfaces';

export class Di implements Command {
  private project: Project;
  private config: DiConfig;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
    this.config = {
      providers: [],
      controllers: [],
      modules: [],
    };
  }

  /**
   * Execute the di command.
   * @param args Command line arguments.
   * @returns 
   */
  public async execute(args: string[]): Promise<void> {
    if (args.includes('--help') || args.includes('-h')) {
      return this.showHelp();
    }

    try {
      this.scan();
      this.generateConfig();

      console.log('✅ Dependency injection configuration generated successfully.');
    } catch (e) {
      console.error('❌ Dependency injection information analysis failed:', e);

      process.exit(1);
    }
  }

  /**
   * Show the help for the di command.
   */
  public showHelp() {
    console.log('bunner-cli di [options]');
    console.log('Description: Scans your project to generate dependency injection configuration.');
    console.log('Options:');
    console.log('  --help, -h  Show this help message.');
  }

  private scan() {
    const sourceFiles = this.project.getSourceFiles('src/**/*.ts');

    for (const sourceFile of sourceFiles) {
      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        const className = cls.getName()!;
        const classDecorators = cls.getDecorators();

        for (const decorator of classDecorators) {
          const decoratorName = decorator.getName();

          if (decoratorName === 'Module') {
            const metadata = this.getModuleDecoratorMetadata(cls);

            this.config.modules.push({ className, ...metadata });
          } else if (decoratorName === 'Controller') {
            const metadata = this.getControllerDecoratorMetadata(cls);

            this.config.controllers.push(metadata);
          } else if (decoratorName === 'Injectable') {
            const metadata = this.getProviderMetadata(cls);

            this.config.providers.push(metadata);
          }
        }
      }
    }
  }

  private generateConfig() {
    const outputPath = path.resolve(process.cwd(), 'di.json');

    Bun.write(outputPath, JSON.stringify(this.config, null, 2));
  }

  private getModuleDecoratorMetadata(cls: ClassDeclaration) {
    const moduleDecoratorMetadata: ModuleDecoratorMetadata = {
      imports: [],
      providers: [],
      controllers: [],
      exports: [],
    };

    const decorator = cls.getDecorators().find(d => d.getName() === 'Module');

    if (!decorator) {
      return moduleDecoratorMetadata;
    }
    
    const arg = decorator.getArguments()[0];

    if (!arg || arg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      return moduleDecoratorMetadata;
    }

    const getArrayProperty = (propName: string) => {
      const prop = (arg as ObjectLiteralExpression).getProperty(propName);
      
      if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) {
        return [];
      }
       
      const initializer = (prop as PropertyAssignment).getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);

      if (!initializer) {
        return [];
      }

      return initializer.getElements().map(e => e.getText().replace(/\[|\]/g, ''));
    };

    moduleDecoratorMetadata.imports = getArrayProperty('imports');
    moduleDecoratorMetadata.providers = getArrayProperty('providers');
    moduleDecoratorMetadata.controllers = getArrayProperty('controllers');
    moduleDecoratorMetadata.exports = getArrayProperty('exports');

    return moduleDecoratorMetadata;
  }
  
  private getControllerDecoratorMetadata(cls: ClassDeclaration) {
    const decorator = cls.getDecorators().find(d => d.getName() === 'Controller');
    const path = decorator ? this.getDecoratorArgs(decorator)[0] || '' : '';
    const methods: MethodMetadata[] = cls.getMethods()
      .filter(method => method.getDecorators().length > 0)
      .map(method => {
        const methodDecorator = method.getDecorators()[0]!;
        const parameters = this.getMethodParameters(method);

        return {
          decoratorName: methodDecorator.getName(),
          decoratorArgs: this.getDecoratorArgs(methodDecorator),
          methodName: method.getName(),
          parameters,
        };
      });

    return {
      className: cls.getName()!,
      path: path,
      dependencies: this.getDependencies(cls),
      methods,
    } as ControllerMetadata;
  }
  
  private getProviderMetadata(cls: ClassDeclaration) {
    return {
      className: cls.getName()!,
      dependencies: this.getDependencies(cls),
    } as ClassMetadata;
  }
  
  private getMethodParameters(method: MethodDeclaration) {
    return method.getParameters()
      .filter(param => param.getDecorators().length > 0)
      .map<ParamMetadata>(param => {
        const decorator = param.getDecorators()[0]!;

        return {
          decoratorName: decorator.getName(),
          decoratorArgs: this.getDecoratorArgs(decorator),
          paramName: param.getName(),
          paramType: param.getType().getText(),
        };
      });
  }
  
  private getDependencies(cls: ClassDeclaration) {
    const constructor = cls.getConstructors()[0];

    if (!constructor) {
      return [];
    } 

    return constructor.getParameters().map<ClassDependency>(param => {
      const paramType = param.getType().getText();
      const cleanedType = paramType.replace(/private |public /, '');
      const injectDecorator = param.getDecorators().find(d => d.getName() === 'Inject');

      if (injectDecorator) {
        const injectArg = this.getDecoratorArgs(injectDecorator)[0];

        return {
          dependencyName: param.getName(),
          dependencyType: injectArg !== undefined ? injectArg : cleanedType,
        };
      }
  
      return {
        dependencyName: param.getName(),
        dependencyType: cleanedType,
      };
    });
  }
  
  private getDecoratorArgs(decorator: Decorator) {
    return decorator.getArguments().map<string>(arg => {
      const kind = arg.getKind();

      if (kind === SyntaxKind.StringLiteral) {
        return arg.getText().slice(1, -1);
      }

      return arg.getText();
    });
  }
}