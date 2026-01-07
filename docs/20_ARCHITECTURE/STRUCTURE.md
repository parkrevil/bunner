# STRUCTURE (Level 2)

> **이 문서는 Bunner 프레임워크 저장소(Monorepo)의 물리적 배치(Placement)를 판정하는 SSOT 문서다.**
>
> 이 문서는 오직 "어디에 위치하는가"와 "물리적으로 어떻게 구성되는가"만을 정의한다. 문서의 권위 위계는 **[SSOT_HIERARCHY](../10_FOUNDATION/SSOT_HIERARCHY.md)** 가, 코드의 세부 명명 및 테스트 작성 규율은 **L4(ENGINEERING)** 가 담당한다.

---

## 1. 저장소 루트 구조 (Root Catalog)

리포지토리 루트는 아래의 디렉토리 및 파일로만 구성된다(EXHAUSTIVE). 허용되지 않은 루트 디렉토리 생성을 금지한다.

| 경로        | 성격           | 판정 기준                                                              |
| :---------- | :------------- | :--------------------------------------------------------------------- |
| `packages/` | **배포물**     | 프레임워크의 핵심 배포 단위(Kernel, Adapters, Common)                  |
| `docs/`     | **지식**       | 시스템의 불변식, 아키텍처, 기능 명세 및 엔지니어링 규율                |
| `tooling/`  | **도구**       | 저장소 유지보수, 빌드, CI/CD 연결을 위한 내부 도구                     |
| `examples/` | **검증**       | 프레임워크 기능 검증 및 배포용 샘플 애플리케이션                       |
| `plans/`    | **실행 실체**  | 에이전트가 작업(Request) 단위로 생성하는 계획/작업 로그/결정 기록 파일 |
| `.agent/`   | **문맥**       | AI 에이전트 구동 지침 및 워크플로우 전용 공간                          |
| `.github/`  | **자동화**     | GitHub 플랫폼 연동(Actions, Templates) 설정                            |
| `.husky/`   | **훅**         | Git Lifecycle 제어용 클라이언트 측 스크립트                            |
| `.jules/`   | **메타데이터** | 프레임워크 형상 관리용 내부 메타데이터                                 |

> **Exclusion Note**: `node_modules/`, `dist/` 등 패키지 매니저나 빌드 도구가 자동 생성하고 관리하는 외부 의존성 및 산출물은 아키텍처 판정 범위에서 제외한다.

### 1.X plans/ 규칙 (Execution Artifacts)

`plans/`는 에이전트가 작업(Request) 단위로 생성하는 계획, 판단 근거, 작업 로그를 저장하는 전용 디렉토리다.

- `plans/` 하위 파일은 **SSOT 문서가 아니다**.
- `plans/` 하위 파일은 **제품 코드가 아니다**.
- `plans/` 하위 파일은 **작업 단위로 생성·갱신·폐기될 수 있다**.
- `plans/` 정리는 **해당 작업 범위에 포함될 때만** 수행할 수 있다.
- `plans/`의 보존/삭제 기준은 **L5(GOVERNANCE)** 문서가 최종 결정한다.

---

## 2. docs/ 배치 규정

`docs/` 하위 디렉토리는 성격에 따라 분리 배치된다.
_(주의: 이 섹션은 문서의 **배치**만을 정의하며, 권위/충돌 해결 규칙은 `SSOT_HIERARCHY.md`를 정본으로 한다.)_

- **[10_FOUNDATION/](../10_FOUNDATION/)**: 불변식 및 위계 정의
- **[20_ARCHITECTURE/](./)**: 구조적 경계 및 물리 배치 규약
- **[30_SPEC/](../30_SPEC/)**: 각 구성 요소의 기능적 계약 명세
- **[40_ENGINEERING/](../40_ENGINEERING/)**: 코딩 스타일, 테스트, 검증 규율
- **[50_GOVERNANCE/](../50_GOVERNANCE/)**: 에이전트 운용 및 저장소 관리 정책
- **[90_REFERENCE/](../90_REFERENCE/)**: 철학, 비전, 로드맵 (Non-SSOT)

> **Path Rule**: docs 하위 문서에서 루트 문서(AGENTS.md 등)를 참조할 경우, 해당 문서의 깊이에 맞는 상대 경로를 사용하되, 절대 경로 참조는 금지한다.

---

## 3. 패키지 형상 표준 (Package Anatomy)

`packages/` 하위의 모든 패키지(Module)는 아래의 물리적 최소 형상을 준수해야 한다.

### 3.1 필수 구성 요소 (MUST)

- `package.json`: 패키지 식별 및 종속성 정의.
- `tsconfig.json`: 해당 패키지의 독자적 컴파일 경계.
- `src/index.ts`: 패키지 외부로 노출되는 **유일한 물리적 Facade**.

### 3.2 선택적 구성 요소 (MAY / WHEN NEEDED)

- `src/internal/`: 패키지 외부로 노출되지 않는 내부 구현체.
- `test/`: 패키지 단위의 검증 코드. (세부 배치는 **L4/TESTING.md**를 따른다.)
- `README.md`: 패키지 수준의 기술 가이드.

---

## 4. 배치 결정 트리 (Placement Decision Tree)

새로운 코드 또는 파일 추가 시 위치를 결정하는 이진 판정 알고리즘이다.

1.  **"프레임워크 배포 아티팩트(Library/Runtime)인가?"**
    - YES $\to$ `packages/` 하위 적정 패키지
    - NO $\to$ 2번으로

2.  **"시스템 설계, 계약, 또는 위계와 관련된 문서인가?"**
    - YES $\to$ `docs/` 하위 번호 디렉토리
    - NO $\to$ 3번으로

3.  **"에이전트의 작업 결과물이나 휘발성 로그인가?"**
    - YES $\to$ `plans/` (Execution Artifacts)
    - NO $\to$ 4번으로

4.  **"저장소 관리, 빌드 스크립트, 린트 도구인가?"**
    - YES $\to$ `tooling/` (Machinery)

5.  **위 조건에 해당하지 않는 경우**
    - 본 문서에 정의되지 않은 루트 또는 상위 디렉토리 배치는 허용되지 않는다. (STOP)

---

## 5. 명명 및 스타일 제약 (Constraint Delegation)

- **Directory Naming**: 모든 디렉토리 명칭은 `kebab-case`를 원칙으로 한다.
- **File Naming**: 파일 수준의 명명 규칙(접미사, 케이스 등)은 본 문서의 영역이 아니며, **[L4/STYLEGUIDE.md](../40_ENGINEERING/STYLEGUIDE.md)** 에 위임한다.
- **Test Placement**: 테스트 파일의 상세 배치 방식은 **[L4/TESTING.md](../40_ENGINEERING/TESTING.md)** 의 결정을 따른다.
