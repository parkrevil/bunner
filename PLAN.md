# Bunner: The Bun-Native AOT Web Framework

## 1. Philosophy: "Bun First, Zero Overhead"

이 프로젝트의 핵심은 **Bun의 네이티브 기능을 극한으로 활용**하여 Node.js 대비 압도적인 성능과 DX를 제공하는 것입니다.

- **Priority 0 (Bun Native)**: `Bun.file`, `Bun.write`, `Bun.build`, `Bun.transpiler` (Scan), `Bun.serve`.
- **Priority 1 (High-Perf Parser)**: `oxc-parser` (via NAPI) for AST Analysis & DI Extraction.
- **Priority 2 (Deep Analysis)**: `typescript` (Analysis-only) for Shape/Schema extraction where OXC is insufficient.

---

## 2. Directory Structure & granular Implementation

```text
bunner/
├── packages/
│   ├── cli/                    # [Build-Time] The Compiler Engine
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── dev.ts      # 'bunner dev' (Watch Mode)
│   │   │   │   └── build.ts    # 'bunner build' (Prod Bundle)
│   │   │   ├── analyzer/       # Hybrid Analysis Engine
│   │   │   │   ├── source-scanner.ts # Priority 0: Bun.Transpiler.scan()
│   │   │   │   ├── ast-parser.ts     # Priority 1: OXC Parser (Class/DI)
│   │   │   │   └── type-resolver.ts  # Priority 2: TS Compiler (Schema/Validation)
│   │   │   ├── generators/     # Code Generation (Pure JS strings)
│   │   │   │   ├── manifest.ts # Generates bunner.manifest.ts
│   │   │   │   ├── injector.ts # Generates DI Factories
│   │   │   │   ├── validator.ts # Generates Typia-like checks
│   │   │   │   └── router.ts   # Generates Route Table
│   │   │   └── utils/
│   │   │       └── hasher.ts   # Bun.hash for Incremental Builds
│   │   └── bin/
│   │       └── bunner.ts
│   │
│   ├── core/                   # [Runtime] Lightweight Executives
│   │   ├── src/
│   │   │   ├── injector/
│   │   │   │   ├── container.ts # Map<Token, Factory>
│   │   │   │   └── types.ts     # Manifest Interfaces
│   │   │   ├── pipeline/
│   │   │   │   └── validator.ts # Runtime Error Wrapper
│   │   │   └── common/
│   │
│   └── http-server/            # [Runtime] Bun.serve Wrapper
│       ├── src/
│       │   ├── bunner-server.ts # Loads Manifest & Starts Bun.serve
│       │   └── router/         # Static Route Lookup
│
└── examples/
    └── simple-http/            # Reference Implementation
        ├── .bunner/            # [Generated] Dev Artifacts
        └── src/
```

---

## 3. Detailed Component Specifications

### 3.1. CLI Engine (`@bunner/cli`)

#### **A. Hybrid Analysis Engine (`src/analyzer/*`)**

- **Logic**: 3-Layer strategy for maximum performance.
  1. **Layer 0 (Dependency Graph)**: `Bun.Transpiler`의 `scan()`을 사용하여 파일 간 import/export 관계만 초고속으로 파악. 변경된 파일의 영향 범위를 계산.
  2. **Layer 1 (Structure & DI)**: `oxc-parser`를 사용하여 AST를 파싱.
     - **Goal**: Class Name, Constructor Parameter Names, Decorators 식별.
     - **Outcome**: DI Token 추출 및 Controller Route 분석. `typescript`보다 월등히 빠름.
  3. **Layer 2 (Type Shapes)**: `typescript.createProgram` (최후의 수단).
     - **Goal**: Validation 로직 생성을 위한 복잡한 Type (Interface, Generic) 분석.
     - **Optimization**: Validation이 필요한 DTO 파일에 대해서만 제한적으로 실행.

#### **B. Incremental Watcher (`src/commands/dev.ts`)**

- **Bun Native Feature**: `Bun.file`, `Bun.hash`
- **Logic**:
  1. `bunner dev` 실행 시, `src/**/*.ts` 파일들의 해시를 계산하여 비교.
  2. 변경된 파일에 대해 **Layer 0 (Scan)** 실행 -> 영향받는 모듈 식별.
  3. 필요한 분석 레벨에 따라 **Layer 1 (OXC)** 또는 **Layer 2 (TS)** 선택 실행.
  4. `.bunner/manifest.ts` 부분 갱신 (Atomic Write).

#### **C. Code Generator (`src/generators/*`)**

- **Bun Native Feature**: `Bun.write`
- **Implementation**:
  - `oxc-parser` AST 결과를 바탕으로 Factory Code 생성.
  - 필요한 경우 `ts.TypeChecker` 결과를 바탕으로 Validator Code 생성.

### 3.2. Runtime Core (`@bunner/core`)

#### **A. AOT Container (`src/injector/container.ts`)**

- **Requirement**: `reflect-metadata` **Zero Usage**.
- **Logic**:
  - 앱 시작 시 `manifest.ts`에서 생성된 `factories` 맵을 로드.
  - `get(token)`은 단순 `Map.get()` 연산.

### 3.3. HTTP Server (`@bunner/http-server`)

#### **A. Bun.serve Integration**

- **Bun Native Feature**: `Bun.serve`
- **Logic**:
  - CLI가 생성한 `router-table.js`를 로드.
  - `fetch(req)` 핸들러 내부에서 정적 라우팅 수행.

### 3.4. Configuration (`bunner.config.ts`)

- **Standardization**: 프로젝트 루트의 설정을 로드하여 CLI 동작을 제어합니다.
  ```typescript
  export default {
    entry: './src/main.ts',
    compiler: {
      strictValidation: true,
      minify: true,
    },
  };
  ```

---

## 4. Development & Build Workflow

### **Development (`bunner dev`)**

1. **Fast Scan**: `Bun.Transpiler`로 변경 파일 감지 및 의존성 그래프 갱신.
2. **Fast Parse**: `oxc-parser`로 변경된 클래스 파싱 (DI/Router 갱신).
3. **Deep Analysis**: DTO 변경 시에만 `ts.createProgram` 실행 (Validation 갱신).
4. **Generate**: `.bunner/` 아티팩트 갱신.
5. **Execute**: `bun run --watch .bunner/index.ts`.

### **Production (`bunner build`)**

1. **Generate**: `dist/generated/`에 모든 아티팩트 생성 (Full Analysis).
2. **Bundle**: `Bun.build` API를 호출하여 번들링.
   ```typescript
   await Bun.build({
     entrypoints: ['./src/main.ts'],
     outdir: './dist',
     target: 'bun',
     sourcemap: 'external',
     minify: true,
   });
   ```

---

## 5. Implementation Tasks Checklist

### Phase 1: The Analyzer (Priority: Bun > OXC > TS)

- [ ] **CLI Infrastructure**: `packages/cli` 셋업.
- [ ] **Source Scanner**: `analyzer/source-scanner.ts` 구현 (`Bun.Transpiler.scanImports`).
- [ ] **AST Parser**: `analyzer/ast-parser.ts` 구현 (`oxc-parser`).
  - 생성자 파라미터 타입명 추출 로직 (DI).
- [ ] **Type Resolver**: `analyzer/type-resolver.ts` 구현 (`ts.createProgram`).
  - Validation 로직 생성용.

### Phase 2: The Generator (Codegen)

- [ ] **Manifest Generator**: `manifest.ts` 생성 로직.
- [ ] **Injector Generator**: OXC AST 기반 Factory 함수 생성.
- [ ] **Path Resolver**: 상대 경로 계산 유틸리티.

### Phase 3: The Core (Runtime)

- [ ] **Clean Core**: `reflect-metadata` 제거.
- [ ] **AOT Container**: Manifest 로더 및 컨테이너 구현.

### Phase 4: Integration

- [ ] **Bunner Dev**: Incremental Build 파이프라인 완성.
- [ ] **Bunner Build**: Production Build 파이프라인 완성.

---

## 6. Critical Technical Challenges & Solutions

### **A. AST vs Type Checker Consistency**

- **Risk**: `oxc-parser`가 파악한 타입명("UserDto")과 `ts`가 파악한 타입 정보가 불일치할 가능성.
- **Solution**: DI 토큰은 단순 명칭(String Literal/Symbol)으로 관리하고, 형태(Shape) 검증이 필요한 경우만 TS를 사용하는 **역할 분리**를 엄격히 적용.

### **B. Path Aliases & Imports**

- **Risk**: Generated Code에서의 Import 경로 문제.
- **Solution**: Codegen 단계에서 모든 경로를 상대 경로(`../../src/`)로 정규화하여 생성.

### **C. Debugging**

- **Solution**: `sourcemap: 'external'` 필수 적용.
