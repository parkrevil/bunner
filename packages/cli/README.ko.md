# @bunner/cli

한국어 | **[English](./README.md)**

[Bunner](https://github.com/parkrevil/bunner)의 공식 CLI 도구 — AOT(Ahead-of-Time) 컴파일을 지원하는 초고속 Bun 네이티브 서버 프레임워크입니다.

[![Bun](https://img.shields.io/badge/Bun-v1.0%2B-000?logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [요구사항](#요구사항)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [명령어](#명령어)
  - [`bunner dev`](#bunner-dev)
  - [`bunner build`](#bunner-build)
- [아키텍처](#아키텍처)
  - [Analyzer 모듈](#analyzer-모듈)
  - [Generator 모듈](#generator-모듈)
  - [Watcher 모듈](#watcher-모듈)
- [설정](#설정)
- [생성되는 아티팩트](#생성되는-아티팩트)
- [Public API](#public-api)
- [제한사항](#제한사항)
- [문제 해결](#문제-해결)
- [기여하기](#기여하기)
- [라이선스](#라이선스)

---

## 개요

`@bunner/cli`는 Bunner 프레임워크의 커맨드라인 인터페이스입니다. AOT(Ahead-of-Time) 컴파일을 위한 필수 개발 도구를 제공하며, 다음을 가능하게 합니다:

- TypeScript 소스 파일의 **정적 분석**
- 모듈 간 **의존성 그래프 구축**
- 최적화된 런타임 부트스트랩을 위한 **코드 생성**
- 파일 감시를 통한 **핫 리로드 개발**

CLI는 빌드 시점에 애플리케이션을 분석하고 최적화하여, 런타임 리플렉션 오버헤드를 제거하고 더 빠른 시작 시간을 보장합니다.

## 주요 기능

- 🚀 **AOT 컴파일** — 빌드 시점에 데코레이터, 의존성, 모듈 구조 분석
- 🔍 **TypeScript AST 파싱** — [oxc-parser](https://github.com/nicodemus-ouma/oxc-parser)를 활용한 초고속 파싱
- 📦 **모듈 그래프 해석** — 모듈 경계의 자동 발견 및 검증
- 🔄 **핫 리로드** — 증분 리빌드를 지원하는 워치 모드로 빠른 개발
- ✅ **가시성 & 스코프 검증** — 의존성 주입 제약 조건의 컴파일 타임 검사
- 🔁 **순환 의존성 감지** — 모듈 레벨의 순환 참조 감지 및 리포트

## 요구사항

| 요구사항       | 버전      | 비고                                                  |
| -------------- | --------- | ----------------------------------------------------- |
| **Bun**        | `≥ 1.0.0` | 필수 런타임                                           |
| **TypeScript** | `≥ 5.0`   | 소스 파일은 TypeScript여야 함                         |
| **Node.js**    | 미지원    | 이 CLI는 Bun 전용이며, Node.js 런타임은 지원하지 않음 |

> **참고**: 이 패키지는 Bun 전용 API(`Bun.build()`, `Bun.file()`, `Bun.spawn()`)를 사용하므로 Node.js에서는 실행할 수 없습니다.

## 설치

```bash
bun add -d @bunner/cli
```

또는 전역 설치:

```bash
bun add -g @bunner/cli
```

## 빠른 시작

1. **프로젝트 구조 생성:**

```text
my-app/
├── src/
│   ├── main.ts          # 애플리케이션 진입점
│   └── __module__.ts    # 루트 모듈 정의
├── bunner.config.ts     # CLI 설정 (선택사항)
└── package.json
```

1. **개발 서버 실행:**

```bash
bunner dev
```

1. **프로덕션 빌드:**

```bash
bunner build
```

## 명령어

### `bunner dev`

AOT 아티팩트 생성과 파일 감시를 포함한 개발 환경을 시작합니다.

```bash
bunner dev
```

**수행 작업:**

1. `src/` 디렉토리의 모든 `.ts` 파일 스캔
2. 클래스 메타데이터, 데코레이터, 모듈 정의 파싱 및 추출
3. 모듈 의존성 그래프 빌드
4. `.bunner/` 디렉토리에 AOT 아티팩트 생성:
   - `injector.ts` — 의존성 주입 컨테이너 설정
   - `manifest.ts` — 런타임 메타데이터 레지스트리
   - `index.ts` — 애플리케이션 진입점
5. 파일 변경 감시 및 증분 리빌드

**출력:**

```text
🚀 Starting Bunner Dev...
🛠️  AOT artifacts generated.
   Entry: .bunner/index.ts
```

### `bunner build`

모든 최적화가 적용된 프로덕션용 번들을 생성합니다.

```bash
bunner build
```

**수행 작업:**

1. 전체 소스 분석 수행 (`dev`와 동일)
2. 검증을 포함한 모듈 그래프 빌드
3. `.bunner/`에 중간 매니페스트 생성
4. `Bun.build()`를 사용하여 애플리케이션, 매니페스트, 워커 번들링
5. `dist/` 디렉토리에 출력

**출력:**

```text
🚀 Starting Bunner Production Build...
📂 Project Root: /path/to/my-app
📂 Source Dir: /path/to/my-app/src
📂 Output Dir: /path/to/my-app/dist
🔍 Scanning source files...
🕸️  Building Module Graph...
🛠️  Generating intermediate manifests...
📦 Bundling application, manifest, and workers...
✅ Build Complete!
   Entry: dist/entry.js
   Manifest: dist/manifest.js
```

## 아키텍처

CLI는 세 가지 주요 모듈로 구성됩니다:

### Analyzer 모듈

`src/analyzer/`에 위치하며, TypeScript 소스 코드의 정적 분석을 담당합니다.

| 컴포넌트          | 설명                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `AstParser`       | oxc-parser를 사용하여 TypeScript 파일 파싱; 클래스, 데코레이터, 임포트, 모듈 정의 추출 |
| `AstTypeResolver` | 타입 어노테이션을 문자열로 해석                                                        |
| `ModuleDiscovery` | `__module__.ts` 파일 발견 및 소스 파일 소유권 할당                                     |
| `ModuleGraph`     | 의존성 그래프 빌드, 가시성/스코프 규칙 검증, 순환 참조 감지                            |
| `ModuleNode`      | 프로바이더, 컨트롤러, 익스포트를 포함한 단일 모듈 표현                                 |

### Generator 모듈

`src/generator/`에 위치하며, 코드 생성을 담당합니다.

| 컴포넌트            | 설명                                              |
| ------------------- | ------------------------------------------------- |
| `InjectorGenerator` | 팩토리 함수를 포함한 DI 컨테이너 설정 코드 생성   |
| `ManifestGenerator` | 리플렉션을 위한 런타임 메타데이터 레지스트리 생성 |
| `EntryGenerator`    | 애플리케이션 부트스트랩 진입점 생성               |
| `ImportRegistry`    | 임포트 중복 제거 및 앨리어싱 관리                 |
| `MetadataGenerator` | OpenAPI/검증을 위한 타입 메타데이터 생성          |

### Watcher 모듈

`src/watcher/`에 위치하며, 개발 모드를 위한 파일 시스템 감시를 제공합니다.

| 컴포넌트         | 설명                                       |
| ---------------- | ------------------------------------------ |
| `ProjectWatcher` | 소스 디렉토리의 변경 감시 및 리빌드 트리거 |

## 설정

프로젝트 루트에 `bunner.config.ts`를 생성하세요:

```typescript
import type { BunnerConfig } from '@bunner/cli';

export default {
  // 워커 프로세스 수 (0 = 자동, 'full' = 전체 코어, 'half' = 절반 코어)
  workers: 1,

  // 모듈 스캔을 위한 추가 경로
  scanPaths: ['../packages/shared/src'],
} satisfies BunnerConfig;
```

### 설정 옵션

| 옵션        | 타입                                   | 기본값   | 설명                           |
| ----------- | -------------------------------------- | -------- | ------------------------------ |
| `workers`   | `number \| 'full' \| 'half' \| string` | `'half'` | 워커 수 설정                   |
| `scanPaths` | `string[]`                             | `[]`     | 모듈 스캔을 위한 추가 디렉토리 |

## 생성되는 아티팩트

CLI는 `.bunner/` (dev) 또는 `dist/` (build)에 다음 파일들을 생성합니다:

### `injector.ts`

DI 컨테이너를 설정하는 `createContainer()` 함수를 포함합니다:

```typescript
import { Container } from '@bunner/core';

export function createContainer() {
  const container = new Container();

  container.set('AppModule::UserService', c => new UserService(c.get('AppModule::UserRepository')));
  // ... 더 많은 프로바이더

  return container;
}

export const adapterConfig = deepFreeze({
  // __module__.ts의 어댑터 설정
});
```

### `manifest.ts`

애플리케이션의 런타임 메타데이터를 포함합니다:

```typescript
export function createScopedKeysMap() {
  return new Map([
    ['UserService', 'AppModule::UserService'],
    // ... 스코프된 토큰 매핑
  ]);
}
```

### `index.ts` (Entry)

컨테이너를 초기화하고 애플리케이션을 로드하는 부트스트랩 진입점:

```typescript
const isWorker = !!process.env.BUNNER_WORKER_ID;

if (!isWorker) {
  // 마스터 프로세스 - 워커 시작 또는 직접 실행
  await bootstrap();
} else {
  await bootstrap();
}

async function bootstrap() {
  const manifest = await import('./manifest.ts');
  const container = manifest.createContainer();

  globalThis.__BUNNER_CONTAINER__ = container;

  await import('./src/main.ts');
}
```

## Public API

CLI는 도구 통합을 위한 최소한의 public API를 노출합니다:

```typescript
import { BunnerCliError } from '@bunner/cli';
import { TypeMetadata } from '@bunner/cli';
```

| Export           | 설명                                          |
| ---------------- | --------------------------------------------- |
| `BunnerCliError` | CLI 관련 에러의 기본 클래스                   |
| `TypeMetadata`   | 생성기 출력을 위한 타입 메타데이터 인터페이스 |

## 제한사항

다음 기능들은 **아직 지원되지 않습니다**:

| 기능                          | 상태      | 비고                                  |
| ----------------------------- | --------- | ------------------------------------- |
| JavaScript 소스 파일          | ❌        | `.ts` 파일만 분석됨                   |
| 프로바이더 내 동적 `import()` | ❌        | 정적 임포트만 지원                    |
| 데코레이터 메타데이터 보존    | ⚠️ 부분적 | 특정 데코레이터만 인식됨              |
| 모노레포 워크스페이스 해석    | ⚠️ 부분적 | 크로스 패키지 스캔은 `scanPaths` 사용 |
| 증분 타입 체킹                | ❌        | 변경 시마다 전체 재분석               |
| 개발 모드 소스맵              | ❌        | 향후 릴리스 예정                      |

### 지원 계획 없음

- **Node.js 호환성** — Bun 네이티브 프레임워크입니다
- **CommonJS 모듈** — ESM만 지원
- **클래스 기반 모듈 데코레이터** — `__module__.ts` 파일 컨벤션을 대신 사용

## 문제 해결

### 자주 발생하는 에러

#### `Error: Cannot find __module__.ts`

**원인**: CLI는 각 모듈 디렉토리에 `__module__.ts` 파일이 있어야 합니다.

**해결 방법**: `__module__.ts` 파일을 생성하세요:

```typescript
import type { BunnerModule } from '@bunner/common';

export const module: BunnerModule = {
  name: 'MyModule',
  providers: [],
};
```

#### `Visibility Violation: '...' is NOT exported`

**원인**: 모듈 A의 프로바이더가 모듈 B의 exported 되지 않은 프로바이더를 주입하려고 합니다.

**해결 방법**: 프로바이더의 `@Injectable` 데코레이터에 `visibility: 'exported'`를 추가하세요:

```typescript
@Injectable({ visibility: 'exported' })
export class SharedService {}
```

#### `Circular dependency detected`

**원인**: 모듈 A가 모듈 B에 의존하고, 모듈 B가 모듈 A에 의존합니다.

**해결 방법**:

- 순환을 끊도록 리팩토링
- 공유 의존성을 세 번째 모듈로 추출
- 생성자 주입에 `forwardRef()` 사용 (권장하지 않음)

#### `oxc-parser` 에러로 빌드 실패

**원인**: oxc-parser가 지원하지 않는 문법 또는 잘못된 TypeScript.

**해결 방법**:

- TypeScript가 유효한지 확인 (`bun tsc --noEmit`)
- 지원되지 않을 수 있는 실험적 문법 확인

### FAQ

**Q: 기존 NestJS 프로젝트와 함께 사용할 수 있나요?**

A: 아니요. Bunner는 다른 모듈 시스템(`__module__.ts` 파일)을 사용하며 NestJS 데코레이터와 호환되지 않습니다.

**Q: `bunner dev`와 `bun run`을 별도로 실행해야 하나요?**

A: `bunner dev`는 AOT 아티팩트만 생성합니다. 애플리케이션은 `bun .bunner/index.ts`로 별도로 실행하거나 `package.json` 스크립트를 구성해야 합니다.

**Q: 변경사항이 반영되지 않는 이유는?**

A: 워처가 실행 중인지 확인하세요. 콘솔 출력에서 파싱 에러를 확인하세요.

## 기여하기

기여를 환영합니다! 자세한 내용은 [기여 가이드](../../CONTRIBUTING.md)를 참조하세요.

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'feat: add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 라이선스

MIT © [ParkRevil](https://github.com/parkrevil)

---

<p align="center">
  Bun 생태계를 위해 ❤️로 만들었습니다
</p>
