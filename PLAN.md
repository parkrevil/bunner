# Bunner Development Plan

이 문서는 Bunner 프레임워크의 고도화를 위한 단계별 개발 계획을 정의합니다. `packages/cli`와 `packages/core`를 중심으로 분석 엔진 강화, DX 개선, 성능 최적화를 순차적으로 진행합니다.

## 디렉토리 구조 및 클린 코드 원칙

모든 개발은 모듈화와 책임 분리를 원칙으로 합니다. 특히 CLI 패키지의 구조를 다음과 같이 정비하며 진행합니다.

```text
packages/cli/src/
├── analyzer/           # AST 파싱 및 정적 분석 (Phase 1)
│   ├── type-resolver/  # 복잡한 타입 및 제네릭 분석기
│   ├── graph/          # 의존성 그래프 및 순환 참조 탐지기
│   └── scope/          # Import 스코프 및 심볼 해석기
├── generator/          # JIT 코드 및 메타데이터 생성 (Phase 2)
│   ├── templates/      # 코드 생성 템플릿
│   └── jit-debugger/   # SourceURL 및 Pretty Print 유틸리티
├── watcher/            # 파일 감지 및 증분 빌드 (Phase 3)
└── common/             # 공통 유틸리티 (Bun 최적화 I/O 등)
```

---

## Phase 1: 분석 엔진 고도화 (Analysis Engine Refactoring)

**목표**: TypeScript의 복잡한 타입 시스템을 완벽히 이해하고, 정확한 의존성 관계를 파악하는 강력한 분석 엔진을 구축합니다.

### 1-1. AST 파서 구조 개편 및 타입 리졸버 강화

- [x] `packages/cli/src/analyzer` 내부 구조 리팩토링 (단일 파일에서 모듈 단위로 분리)
- [x] **Recursive Type Analyzer** 구현
  - [x] `Promise<T>`, `Array<T>` 등 제네릭 타입의 재귀적 파싱 로직 구현
  - [x] `Partial`, `Pick`, `Omit` 등 TypeScript 유틸리티 타입 해석 로직 추가
  - [ ] 외부 라이브러리(`node_modules`)의 `.d.ts` 파일 파싱 및 타입 추적 기능 구현 (Phase 1.5로 이월)

### 1-2. 의존성 그래프(Dependency Graph) 구축

- [x] 프로젝트 전체 모듈 간의 의존성 관계를 메모리 상에 그래프 자료구조로 구축
- [x] Import/Export 구문을 기반으로 한 모듈 연결성 파악 로직 구현
- [ ] 그래프 순회 알고리즘을 통한 데드 코드 식별 및 최적화 기반 마련 (추후 과제)

---

## Phase 2: 진단 및 JIT 안정성 강화 (Diagnosis & JIT Stability)

**목표**: 프레임워크 특화 에러에 대한 친절한 해결 가이드를 제공하고, 동적 생성 코드의 디버깅 편의성을 확보합니다.

### 2-1. 지능형 순환 참조 탐지기 (Smart Circular Detector)

- [ ] Phase 1에서 구축한 의존성 그래프를 활용하여 사이클(`A -> B -> A`) 탐지 알고리즘 구현
- [ ] 사이클 발생 시 **가장 적절한 단절 지점(Cut Point)** 추천 알고리즘 개발
- [ ] 에러 메시지에 시각적 경로(`Cycle Path`) 표시 및 `forwardRef` 적용 코드 조각 제공 로직 구현

### 2-2. JIT 코드 생성기 개선 (JIT Debugging)

- [ ] `new Function` 생성 문자열에 `//# sourceURL=bunner://...` 메타 태그 자동 삽입
- [ ] 생성된 JS 코드의 가독성을 위한 **Pretty Printer** (들여쓰기, 포맷팅) 적용
- [ ] JIT 코드 내 변수명 이스케이프 처리를 통한 Code Injection 방지 및 보안성 강화

---

## Phase 3: 개발자 경험 및 성능 최적화 (DX & Optimization)

**목표**: 대규모 프로젝트에서도 즉각적인 피드백을 주는 Watcher를 만들고, Bun 네이티브 기능을 활용해 빌드 속도를 단축합니다.

### 3-1. 지능형 Watcher 및 증분 빌드 (Incremental Build)

- [ ] `Bun.watch` 기반의 파일 변경 감지기 구현
- [ ] **Dependency Graph 기반 Invalidation**: 변경된 파일과 그 파일을 사용하는 상위 모듈만 선별하여 재분석하는 로직 구현
- [ ] 파일 해시(Hash) 캐싱을 통한 불필요한 재빌드 방지

### 3-2. Bun Native I/O 최적화

- [ ] CLI 및 Core 패키지 내 모든 `fs` 모듈 사용처를 `Bun.file`, `Bun.write`로 전면 교체
- [ ] 대용량 파일 처리 시 스트림(Stream) 기반 처리 검토 및 적용
- [ ] 동기식(Sync) I/O 로직을 비동기식(Async)으로 전환하여 블로킹 최소화

---

## Future Phase: HTTP Server 최적화 (보류) in `http-server`

_현재 CLI/Core 안정화 이후 진행_

- [ ] Response 객체 생성 시 Zero-copy 전략 적용 (`Bun.file` 직접 전송 등)
- [ ] 라우터 매칭 알고리즘 최적화 (Radix Tree 등)
