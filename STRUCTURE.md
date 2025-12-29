# STRUCTURE

## 목적

- 디렉토리/파일 배치 규칙을 판정 가능한 기준으로 고정한다.
- 신규 파일/디렉토리 생성 시 Placement 결정을 SSOT로 제공한다.

## 적용 범위

- `packages/*` 전 패키지 및 `examples/*`를 포함한 레포 전체

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.
- 아키텍처 경계/패키지 의존 방향은 [ARCHITECTURE.md](ARCHITECTURE.md)가 우선한다.
- 네이밍/예약 파일명 규칙은 [STYLEGUIDE.md](STYLEGUIDE.md)가 SSOT다.

## 규범 용어

이 문서에서 사용되는 MUST / MUST NOT / SHOULD / MAY는
[SPEC.md](SPEC.md)의 정의를 따른다.

## 표준 레이아웃 (패키지)

모든 패키지는 아래 구조를 **표준 레이아웃(Standard Layout)**으로 따라야 한다(MUST).

```text
packages/[package-name]/
├── index.ts                    # Public Facade (외부 노출 관문)
├── package.json
├── tsconfig.json
├── README.md
└── src/
   ├── index.ts                # Internal Facade (src 내부 기능 모듈 정리)
   ├── common/                 # 동일 패키지 내 여러 feature가 공유하는 코드만 허용
   │   ├── constants.ts
   │   ├── enums.ts
   │   ├── interfaces.ts
   │   ├── types.ts
   │   └── index.ts
   └── <feature>/              # 기능 모듈(Vertical Slice)
      ├── constants.ts
      ├── enums.ts
      ├── interfaces.ts
      ├── types.ts
      ├── errors/
      │   └── *.error.ts
      ├── *.ts
      ├── *.spec.ts
      └── index.ts             # Feature Barrel

packages/[package-name]/
└── test/                       # 패키지 단위 테스트(통합/E2E/도구)
   ├── common/                  # 테스트 공용 유틸/픽스처
   ├── tools/                   # 테스트 도구(테스트 키트, 헬퍼)
   ├── integration/             # 통합 테스트
   │  └── <feature-or-module>/  # 기능/모듈 단위로 디렉토리 분리 가능
   └── e2e/                     # E2E 테스트
      └── <feature-or-module>/  # 기능/모듈 단위로 디렉토리 분리 가능
```

주의(집행 방식):

- 레거시 패키지는 현 상태 유지를 이유로 예외를 주장할 수 없다.
- 해당 패키지를 수정하는 작업이 발생하면, 작업 범위 내에서 본 문서의 규칙을 이행해야 한다(MUST).
- 전면 예외가 필요한 경우 [GOVERNANCE.md](GOVERNANCE.md)의 승인이 필요하다.

## 생성 규칙(결정 트리)

새 파일/디렉토리를 추가할 때는 아래 질문 순서로 위치를 결정한다.

1. 이 코드가 다른 패키지에서도 재사용되어야 하는가?

- YES: 패키지 경계(어떤 패키지가 소유하는가)부터 확정한다.
- NO: 다음 질문으로 이동한다.

2. 같은 패키지 안에서 서로 다른 feature 둘 이상이 공유하는가?

- YES: `src/common/`에 둔다.
- NO: 다음 질문으로 이동한다.

3. 하나의 feature 내부에서만 공유되는가?

- YES: `src/<feature>/`에 둔다.
- NO: 다음 질문으로 이동한다.

4. 오직 단일 구현 파일에서만 사용되는가?

- YES: 해당 구현 파일과 같은 feature 디렉토리에 둔다.

결정 트리로도 위치가 명확하지 않은 경우:

- 임의로 배치해서는 안 된다(MUST NOT).
- 판단 근거를 PR 설명에 명시하고, 필요 시 [ARCHITECTURE.md](ARCHITECTURE.md) 기준으로 승격 판단한다.

## `src/common/` 배치 강제 규칙 (Enforced)

`src/common/`는 “공유 코드”를 위한 디렉토리이며, 편의상 dumping 장소가 아니다.
아래 규칙 중 하나라도 위반되면 `src/common/` 배치는 금지된다(MUST NOT).

1. **최소 소비자 수(강제)**

- 신규 파일/심볼을 `src/common/`에 추가하려면, 동일 패키지 내 **서로 다른 feature 2개 이상**에서
  실제로 import/사용됨을 증명해야 한다(MUST).
- “곧 쓸 예정”이라는 이유로 `src/common/`에 선배치하는 행위는 금지한다(MUST NOT).

2. **증명 방식(강제)**

- PR 설명에는 최소한 아래 항목을 반드시 포함해야 한다(MUST).
  - 공용으로 올린 대상(파일/심볼) 목록
  - 소비하는 feature 목록(예: `src/foo/**`, `src/bar/**`)
  - 왜 각 feature 내부 배치로는 안 되는지(중복 제거/순환 차단/테스트 격리 등)

3. **금지 패턴(강제)**

- 단일 feature만 사용하거나, 단일 파일만 사용하면서도 `src/common/`에 배치하는 행위는 금지한다(MUST NOT).
- “import 경로를 짧게 만들기 위해” `src/common/`으로 올리는 행위는 금지한다(MUST NOT).
- 실질적으로 범용성이 없는 `utils.ts`/`helpers.ts` 류 파일을 `src/common/`에 추가하는 행위는 금지한다(MUST NOT).

4. **예외(허용 조건)**

- 순환 참조를 방지하기 위한 최소 공용화가 필요하고, 해당 공용화가 실제로 순환을 제거함을
  설명할 수 있는 경우에 한해 예외가 가능하다(MAY).
  - 단, 이 경우에도 “소비자 2개 이상” 조건은 유지된다(MUST).

## 테스트 배치 규칙

- 유닛 테스트는 테스트 대상 파일과 같은 디렉토리에 두어야 한다(MUST).
  - 예: `src/<feature>/foo.ts` ↔ `src/<feature>/foo.spec.ts`
- 패키지 단위 테스트는 `packages/<pkg>/test/`에 두어야 한다(MUST).
  - `test/integration/` 및 `test/e2e/` 디렉토리가 존재할 수 있다(MAY).
  - `test/integration/<feature-or-module>/` 및 `test/e2e/<feature-or-module>/`처럼 기능/모듈별 하위 디렉토리를 둘 수 있다(MAY).
  - `test/tools/`, `test/common/` 같은 테스트 도구/공용 유틸 디렉토리가 존재할 수 있다(MAY).

## 디렉토리별 의미

- `packages/<pkg>/`: 배포/의존성의 단위(패키지 경계)
- `packages/<pkg>/src/`: 해당 패키지의 기능 코드가 존재하는 유일한 위치
- `packages/<pkg>/src/common/`: 동일 패키지 내 여러 feature가 공유하는 코드만 허용
- `packages/<pkg>/src/<feature>/`: 기능 모듈(Vertical Slice)

## Feature 경계 import 규칙 (Barrel via Feature Index)

- 같은 feature 내부의 상대 경로 import는 허용된다(MAY).
- 다른 feature로 넘어가는 import는 반드시 해당 feature의 barrel(`src/<feature>/index.ts`) 또는 `src/index.ts`를 통해서만 가능하다(MUST).
- 다른 feature의 구현 파일을 직접 import 해서는 안 된다(MUST NOT).

## 파일별 의미

파일명은 [STYLEGUIDE.md](STYLEGUIDE.md)의 네이밍/예약 파일명 규칙을 따른다.

- `packages/<pkg>/index.ts`: Public Facade
- `packages/<pkg>/src/index.ts`: Internal Facade
- `packages/<pkg>/src/<feature>/index.ts`: Feature Barrel
- `constants.ts`: 런타임 상수 선언
- `enums.ts`: enum 선언(규격/프로토콜급에 한정)
- `interfaces.ts`: 경계 계약(Contract) 또는 구현이 강제되어야 하는 객체 형태
- `types.ts`: 유니온/교차/튜플/alias 등 조합/제약 중심 타입
- `errors/*.error.ts`: 기능 전용 에러 타입
- `*.spec.ts`: 유닛 테스트(SSOT는 [TESTING.md](TESTING.md))

## 금지

- 기능 코드를 `src/` 밖에 두어서는 안 된다(MUST NOT).
- 특정 feature 하나에서만 쓰는 코드를 편의로 `src/common/`에 두어서는 안 된다(MUST NOT).

## 추가 금지

- `packages/<pkg>/src/**` 내부 파일을 패키지 외부에서 직접 import 해서는 안 된다(MUST NOT).

## examples 배치 규칙

- `examples/`는 단일 예제 애플리케이션 구조를 기본으로 한다.
- `examples/<name>/src/**` 같은 다중 예제 구조를 도입해서는 안 된다(MUST NOT).
- 다중 examples 구조가 필요한 경우 사전 승인 없이 도입해서는 안 된다(MUST NOT).
- `examples/`는 `packages/` 디렉토리의 모든 패키지와 패키지들의 모든 기능을 포함하는 엔터프라이즈급 사용 예제를 목표로 한다(SHOULD).

`examples/`는 NestJS를 연상하는 모듈러 디렉토리 구조를 따른다.

모듈/feature 구조는 다음 기준으로 단일화한다.

- `examples/src/<module>/`만 “모듈”이다.
- 모듈 내부 하위 디렉토리는 전부 `<feature>/`로만 구성한다.
- 모듈 내부에 “서브 모듈”을 두지 않는다(MUST NOT).
  - 더 작은 DI 경계/의존 단위가 필요하다면, 해당 단위를 `examples/src/<module>/` 레벨의 독립 모듈로 승격한다.

```text
examples/
├── bunner.config.ts
├── package.json
├── tsconfig.json
├── src/
│  ├── main.ts
│  ├── app.module.ts
│  ├── core/                   # 예제 앱 전역 코어(부트스트랩/글로벌 파이프라인)
│  │  ├── bootstrap.ts
│  │  ├── config.ts
│  │  ├── index.ts
│  │  ├── guards/
│  │  │  └── auth.guard.ts
│  │  ├── middleware/
│  │  │  └── logger.middleware.ts
│  │  └── filters/
│  │     └── http-error.filter.ts
│  ├── common/                 # 예제 앱 전역 공용 코드
│  │  ├── constants.ts
│  │  ├── types.ts
│  │  ├── index.ts
│  │  └── errors/
│  │     └── app.error.ts
│  ├── <module>/               # 모듈 (src 바로 아래에 위치)
│  │  ├── <module>.module.ts
│  │  ├── <module>.controller.ts
│  │  ├── <module>.service.ts
│  │  ├── <module>.repository.ts
│  │  ├── dtos/
│  │  │  └── <dto>.ts
│  │  └── <feature>/           # 모듈 내부 feature 하위 디렉토리 (기본값)
│  │     ├── <feature>.controller.ts
│  │     ├── <feature>.service.ts
│  │     ├── <feature>.repository.ts
│  │     └── dtos/
│  │        └── <dto>.ts
│  └── <another-module>/
│     └── <another-module>.module.ts
└── test/                       # 예제 애플리케이션 단위 테스트(통합/E2E/도구)
   ├── common/
   │  ├── fixtures.ts
   │  └── test-app.ts
   ├── tools/
   │  └── test-kit.ts
   ├── integration/
   │  └── <feature-or-module>/
   │     └── <case>.spec.ts
   └── e2e/
      └── <feature-or-module>/
         └── <case>.spec.ts
```

examples 내부 유닛 테스트는 `examples/src/**` 아래에서 테스트 대상 파일과 같은 디렉토리에 두어야 한다(MUST).

모듈 내부는 Feature-first 구조를 사용해야 한다(MUST).

## 생성물(Generated Output) 배치 규칙

- 생성물은 `src/**` 아래에 두어서는 안 된다(MUST NOT).
- 생성물은 패키지 루트 또는 레포 루트 하위의 생성물 전용 디렉토리에 두어야 한다(MUST).
  - 예: `packages/<pkg>/dist/**`, `packages/<pkg>/.bunner/**`, `packages/<pkg>/coverage/**`
  - 예: `dist/**`, `.bunner/**`, `coverage/**`
- 생성물의 저장소 반입 여부 및 예외는 [ARCHITECTURE.md](ARCHITECTURE.md)와 [POLICY.md](POLICY.md)가 SSOT다.
