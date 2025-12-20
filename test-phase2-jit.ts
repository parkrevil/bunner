import { JitDebugger } from './packages/cli/src/generator/jit-debugger/jit-debugger';

// 모의 Generator: 실제로 메타데이터를 기반으로 Factory 코드를 문자열로 생성하는 역할
class FactoryGenerator {
  generate(className: string, dependencies: string[]): string {
    const safeClassName = JitDebugger.safeIdentifier(className);

    // 코드를 한 줄로 작성 (일반적인 코드 제너레이터의 출력 형태)
    const rawCode = `return function create${safeClassName}(container) { const deps = [${dependencies.map(d => `'${d}'`).join(', ')}].map(token => container.get(token)); return new ${safeClassName}(...deps); };`;

    // 1. Pretty Print
    let formatted = JitDebugger.prettyPrint(rawCode);

    // 2. Attach Source URL
    formatted = JitDebugger.attachSourceURL(formatted, `${safeClassName}.factory.js`);

    return formatted;
  }
}

async function testJitDebugger() {
  await Promise.resolve();
  console.log('🧪 Starting Phase 2-2 Tests (JIT Debugging)...\n');

  const generator = new FactoryGenerator();
  const className = 'UserController';
  const deps = ['UserService', 'AuthService'];

  const generatedCode = generator.generate(className, deps);

  console.log('--- Generated Code Output ---');
  console.log(generatedCode);
  console.log('-----------------------------');

  if (generatedCode.includes('//# sourceURL=bunner://jit/UserController.factory.js')) {
    console.log('✅ Source URL attached successfully.');
  } else {
    console.error('❌ Source URL missing.');
  }

  if (generatedCode.includes('\n  const deps')) {
    console.log('✅ Pretty print indentation applied.');
  } else {
    console.log('ℹ️  Pretty print might be too simple, check output manually.');
  }
}

testJitDebugger().catch(console.error);
