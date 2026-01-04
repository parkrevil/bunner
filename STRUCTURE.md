# STRUCTURE

> **STRUCTURE.md는 이 레포에서 파일과 디렉토리의 "배치(Placement)"를 판정하는 SSOT 문서다.**

---

## 1. 루트 디렉토리 구조 (Root Structure)

리포지토리 루트는 아래의 최상위 디렉토리와 헌법 레벨 문서로만 구성된다(MUST).

### 1.1 최상위 디렉토리

| 디렉토리    | 역할        | 판정 기준                                        |
| :---------- | :---------- | :----------------------------------------------- |
| `packages/` | 제품 코드   | 배포되는 패키지(런타임, 라이브러리)가 위치함     |
| `docs/`     | 지식/계약   | 설계, 가이드, 정책, 계약(SPEC) 문서가 위치함     |
| `.agent/`   | AI 컨텍스트 | 에이전트 실행 규칙, 워크플로우, 템플릿이 위치함  |
| `.github/`  | 플랫폼 설정 | GitHub Actions, 이슈 템플릿 등 플랫폼 연동 설정  |
| `tooling/`  | 개발 인프라 | 린터, 커밋 검사기 등 개발 과정에서만 쓰이는 도구 |
| `examples/` | 예제        | 사용자 참고용 구현 예제                          |

### 1.2 헌법 레벨 문서 (Root Documents)

루트의 마크다운 문서는 시스템 전체에 영향을 주는 "헌법" 역할을 수행한다.

- **ARCHITECTURE.md**: 구조, 의존성, 경계 판정의 최상위 정본
- **STRUCTURE.md**: 파일/디렉토리 배치 판정의 정본 (본 문서)
- **VISION.md**: 프로젝트의 핵심 가치와 철학
- **ROADMAP.md**: 아이디어 풀 및 미구현 기능의 초안 (SSOT 아님)
- **STYLEGUIDE.md**: 코딩 스타일 및 네이밍 규칙
- **DEPENDENCIES.md**: 의존성 선언 및 관리 규칙
- **TESTING.md**: 테스트 전략 및 수행 규칙

---

## 2. docs/ 디렉토리 역할 분해

`docs/` 하위는 문서의 성격에 따라 엄격히 분리된다.

- **docs/specs/**: 기능적/비기능적 "계약(Contract)" 정본. (Level 2 SSOT)
- **docs/design/**: 설계의 배경, 근거, 철학(Rationale). (Non-SSOT)
- **docs/governance/**: 운영 정책, 보안, 승인 절차.

---

## 3. 패키지 표준 레이아웃 (Standard Layout)

모든 패키지는 아래 구조를 표준으로 따라야 한다(MUST).

```text
packages/[package-name]/
├── index.ts                # Public Facade (외부 노출 관문)
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts            # Internal Facade
    ├── common/             # 패키지 내 공통 유틸/타입
    └── <feature>/          # 기능 단위 모듈 (Vertical Slice)
        ├── index.ts        # Feature Barrel
        ├── types.ts        # 타입 정의
        ├── interfaces.ts   # 인터페이스 정의
        ├── enums.ts        # 열거형 정의
        ├── constants.ts    # 상수 정의
        └── *.ts            # 구현 파일
```

---

## 4. 배치 결정 트리 (Placement Decision Tree)

새 파일/디렉토리 추가 시 아래 순서로 위치를 결정한다.

1. **이 코드가 배포 대상인가?**
   - NO → `tooling/` 또는 패키지 내 `test/`
   - YES → 2번으로

2. **이 코드가 여러 패키지에서 공유되는가?**
   - YES → `@bunner/common` 또는 신규 foundation 패키지 검토
   - NO → 3번으로

3. **이 코드가 특정 기능(Feature)에 종속되는가?**
   - YES → 패키지 내 `src/<feature>/`
   - NO → 패키지 내 `src/common/` (신중히 결정)

4. **이 파일이 타입/인터페이스/상수인가?**
   - YES → 예약 파일명(`types.ts`, `interfaces.ts`, `constants.ts`)으로 분리
   - NO → 구현 파일(`kebab-case.ts`)로 작성
