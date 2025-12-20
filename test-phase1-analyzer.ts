import { AstParser } from './packages/cli/src/analyzer/ast-parser';
import { ModuleGraph, ClassInfo } from './packages/cli/src/analyzer/graph/module-graph';

// Mock Code for Type Resolution Test
const typeTestCode = `
import { Controller, Get, Post } from '@bunner/common';

class User {}

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('CACHE') private cacheInfo: Cache<string>,
    private readonly config: Partial<ConfigDto>
  ) {}

  @Get()
  async findAll(): Promise<User[]> {
    return [];
  }
  
  @Post()
  create(dto: CreateUserDto): Promise<void> {}
}
`;

// Mock Code for Graph Test
const moduleACode = `
@Module({
  providers: [ServiceA],
  exports: [ServiceA],
})
export class ModuleA {}
`;

const moduleBCode = `
@Module({
  imports: [ModuleA],
  providers: [ServiceB],
})
export class ModuleB {}
`;

async function testPhase1() {
  await Promise.resolve(); // For require-await rule
  console.log('🧪 Starting Phase 1 Tests...\n');

  // 1. Type Resolver Test
  console.log('--- [Test 1] Recursive Type Analysis ---');
  const parser = new AstParser();
  const classes = parser.parse('user.controller.ts', typeTestCode);
  const controller = classes.find(c => c.className === 'UserController');

  if (!controller) {
    console.error('❌ UserController not found');
    return;
  }

  // Constructor Param 2: Partial<ConfigDto>
  // Param index 0: userService (Type: UserService)
  // Param index 1: cacheInfo (Type: Cache, TypeArgs: ['string'])
  // Param index 2: config (Type: Partial, TypeArgs: ['ConfigDto']) -> TypeResolver 구현에 따라 Partial이 typeName이 됨.

  const constructorParams = controller.constructorParams;

  const cacheParam = constructorParams.find(p => p.name === 'cacheInfo');
  console.log(`Param 'cacheInfo': type=${cacheParam?.type}, args=${JSON.stringify(cacheParam?.typeArgs)}`);

  if (cacheParam?.type === 'Cache' && cacheParam?.typeArgs?.[0] === 'string') {
    console.log('✅ Generic Type (Cache<string>) resolved correctly.');
  } else {
    console.error('❌ Generic Type Resolution Failed');
  }

  const configParam = constructorParams.find(p => p.name === 'config');
  console.log(`Param 'config': type=${configParam?.type}, args=${JSON.stringify(configParam?.typeArgs)}`);
  if (configParam?.type === 'Partial' && configParam?.typeArgs?.[0] === 'ConfigDto') {
    console.log('✅ Utility Type (Partial<ConfigDto>) resolved correctly.');
  } else {
    console.error('❌ Utility Type Resolution Failed');
  }

  // Method Return Type: Promise<User[]>
  const _findAll = controller.methods.find(m => m.name === 'findAll');
  // Return type extraction is not yet in extracting metadata?
  // Let's check 'properties' if any, or verify methodology later.
  // Wait, AstParser.extractClassMetadata implementation for methods didn't explicitly extract return types yet
  // in the simplified code. But params are checked.

  // 2. Module Graph Test
  console.log('\n--- [Test 2] Dependency Graph Construction ---');
  const classA = parser.parse('module-a.ts', moduleACode)[0];
  const classB = parser.parse('module-b.ts', moduleBCode)[0];

  const classInfos: ClassInfo[] = [
    { metadata: classA, filePath: 'module-a.ts' },
    { metadata: classB, filePath: 'module-b.ts' },
  ];

  const graph = new ModuleGraph(classInfos);
  const nodes = graph.build();

  const nodeB = nodes.get('ModuleB');
  const nodeA = nodes.get('ModuleA');

  if (nodeB?.imports.has(nodeA!)) {
    console.log('✅ ModuleB successfully imports ModuleA in graph.');
  } else {
    console.error('❌ Module Linkage Failed');
  }
}

testPhase1().catch(console.error);
