import { AstParser } from './packages/cli/src/analyzer/ast-parser';
import { ModuleGraph } from './packages/cli/src/analyzer/module-graph';

const parser = new AstParser();

const userModuleCode = `
import { Module, Injectable, Controller } from '@bunner/core';

@Injectable()
class UserService {}

@Injectable()
class PrivateService {}

@Module({
  providers: [UserService, PrivateService],
  exports: [UserService]
})
export class UsersModule {}
`;

const appModuleCode = `
import { Module } from '@bunner/core';
import { UsersModule } from './user.module';

@Module({
  imports: [UsersModule],
})
export class AppModule {}
`;

// Simulate multi-file parsing
const usersMeta = parser.parse('user.module.ts', userModuleCode);
const appMeta = parser.parse('app.module.ts', appModuleCode);

const allClasses = [
  ...usersMeta.map(m => ({ metadata: m, filePath: 'user.module.ts' })),
  ...appMeta.map(m => ({ metadata: m, filePath: 'app.module.ts' })),
];

const graph = new ModuleGraph(allClasses);
graph.build();

console.log('--- Module Graph Visualization ---');
// console.log(JSON.stringify(graph, null, 2)); // Too verbose

console.log('--- Resolution Tests ---');

// Test 1: Resolve UserService from UsersModule (Self)
const res1 = graph.resolveToken('UsersModule', 'UserService');
console.log(`UsersModule -> UserService: ${res1} (Expected: UsersModule::UserService)`);

// Test 2: Resolve PrivateService from UsersModule (Self)
const res2 = graph.resolveToken('UsersModule', 'PrivateService');
console.log(`UsersModule -> PrivateService: ${res2} (Expected: UsersModule::PrivateService)`);

// Test 3: Resolve UserService from AppModule (Imported)
const res3 = graph.resolveToken('AppModule', 'UserService');
console.log(`AppModule -> UserService: ${res3} (Expected: UsersModule::UserService)`);

// Test 4: Resolve PrivateService from AppModule (Not Exported)
const res4 = graph.resolveToken('AppModule', 'PrivateService');
console.log(`AppModule -> PrivateService: ${res4} (Expected: null)`);
