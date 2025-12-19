import { AstParser } from './packages/cli/src/analyzer/ast-parser';

const parser = new AstParser();

const code = `
import { Module, Injectable, Controller } from '@bunner/core';

@Injectable()
class UserService {}

@Controller('users')
class UserController {}

@Module({
  imports: [],
  controllers: [UserController],
  providers: [
    UserService, 
    { provide: 'API_KEY', useValue: '123' },
    { 
      provide: 'ASYNC_PROVIDER', 
      useFactory: (config) => config.get('KEY'),
      inject: ['ConfigService']
    }
  ],
  exports: [UserService]
})
export class UserModule {}
`;

const result = parser.parse('user.module.ts', code);

console.log(JSON.stringify(result, null, 2));

const userModule = result.find(c => c.className === 'UserModule');
if (userModule) {
  const moduleDec = userModule.decorators.find(d => d.name === 'Module');
  if (moduleDec) {
    console.log('✅ Module Decorator Found');
    const args = moduleDec.arguments[0];
    console.log('Imports:', args.imports);
    console.log('Controllers:', args.controllers);
    console.log('Providers:', args.providers);
  } else {
    console.error('❌ Module Decorator NOT Found');
  }
} else {
  console.error('❌ UserModule Class NOT Found');
}
