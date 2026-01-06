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

### 1.2 주요 문서 (Core Documents)

- **README.md**: 사용자/개발자 진입점
- **[AGENTS.md](../../AGENTS.md) (E0)**: AI 에이전트 행동 제한 규약

그 외 모든 규약/설계/가이드는 `docs/` 하위의 위계적 디렉토리에 위치한다.

---

## 2. docs/ 디렉토리 구조 및 위계

`docs/` 하위는 문서의 권위 위계와 성격에 따라 엄격히 분리되며, 디렉토리 번호는 권위의 높이와 읽는 순서를 나타낸다.

- **[00_INDEX.md](00_INDEX.md)**: 전체 문서 내비게이션 SSOT
- **[10_FOUNDATION/](10_FOUNDATION/)**: 시스템 불변식, 위계 정의, 용어 사전
- **[20_ARCHITECTURE/](20_ARCHITECTURE/)**: 아키텍처 경계, 의존성 원칙, 파일 배치
- **[30_SPEC/](30_SPEC/)**: 최상위 기능 명세 및 세부 계약
- **[40_ENGINEERING/](40_ENGINEERING/)**: 코딩 스타일, 테스트, 검증 절차
- **[50_GOVERNANCE/](50_GOVERNANCE/)**: AI 규율 및 저장소 위생 관리 정책
- **[90_REFERENCE/](90_REFERENCE/)**: 철학, 로드맵 (Non-SSOT)
- **[plans/](plans/)**: 에이전트 실행 계획 로그

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
