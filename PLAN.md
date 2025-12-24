# Scalar 재설계 계획 (Module-less, Multi-Adapter Docs)

## 0. 요약
이 문서는 지금까지의 대화에서 합의된 내용을 “실행 가능한 계획”으로 정리합니다.

핵심 결론은 아래 3가지입니다.

- Scalar는 **모듈/컨트롤러로 제공하지 않는다**(사용자는 `Configurer.configure()`에서 직접 설정).
- Scalar가 사용자에게 노출하는 설정 축은 **2개만 유지**한다.
  - `documentTargets`: 어떤 어댑터(들)의 문서를 만들 것인가
  - `httpTargets`: 어떤 HTTP 서버(들)에 문서 URL을 호스팅할 것인가
- HTTP 호스팅을 위해 `http-adapter`는 “컨트롤러 없이 라우트를 붙일 수 있는 채널”이 1개 필요하다.
  - 사용자가 야매로 쓰지 못하도록 **undocumented/internal 채널**로 제공한다.
  - JS/TS 특성상 “완전 비공개”는 불가능하므로, 현실적 비공개(심볼 기반/문서 비노출/타입 비노출)로 간다.

---

## 1. 배경 및 문제 정의

### 1.1 현재 Scalar의 문제
현재 `@bunner/scalar`는 다음 형태를 가진다.

- `ScalarModule.forRoot()` (모듈 기반)
- `ScalarController` (HTTP 컨트롤러 기반)
- `ScalarService` (스펙 생성)

이 구조는 Scalar의 목적(“여러 어댑터의 API 문서 생성/제공”)과 충돌한다.

- 모듈/컨트롤러는 **특정 transport(http-adapter)와 구조적으로 결합**된다.
- 다중 어댑터(HTTP 2개, WS/GRPC/Queue 등)에서
  - 문서가 어느 서버에 붙는지 명확히 제어하기 어렵다.
  - 문서가 여러 개 생기는 건 괜찮지만, “호스팅 대상 선택”이 1급 옵션이 아니다.

### 1.2 패키지 경계(역할) 재확인

#### `@bunner/common`
- 최하위 “계약/공유 레이어”
- 다른 bunner 패키지에 의존하지 않는다.
- 타입/인터페이스/데코레이터(표기용)/유틸 제공

추가로 확인된 경계 위배(설계 냄새):
- `packages/common/src/interfaces.ts`의 `ErrorHandler(err, req, res, next)`는 HTTP 전용 시그니처로 범용 레이어에 부적절.

#### `@bunner/core`
- 런타임 커널
  - 앱 생성/종료
  - DI/스캐닝
  - 라이프사이클 훅 호출
  - 어댑터 오케스트레이션

#### `@bunner/http-adapter`
- HTTP transport 구현
- 미들웨어/라우팅/서버 부트

#### `@bunner/scalar` (재정의)
- “문서 생성 + 호스팅 오케스트레이션”
- 호스팅은 HTTP 서버 위에서만 제공(문서 UI/JSON은 HTTP로 제공)
- Scalar 자체는 서버/컨트롤러를 만들지 않음

---

## 2. 목표(Design Goals)

### 2.1 DX 목표
- 사용자는 모듈 import 없이 `configure()`에서 한 번 호출로 끝낸다.
- 다중 HTTP 서버(예: public/admin)에서
  - 한쪽만 호스팅하거나
  - 둘 다 호스팅할 수 있어야 한다.
- 다중 어댑터(WS/GRPC/Queue 포함)에서도
  - 문서가 여러 개 생성되는 건 허용
  - 어떤 문서를 만들지 선택 가능해야 한다.

### 2.2 비기능 목표
- Scalar는 “진짜 private” 대신 “실질적 비공개(undocumented/internal)” 원칙을 따른다.
- transport 확장은 어댑터별로 전용 컨트롤러를 만드는 게 아니라,
  - “스펙 생산자(Producer)”를 추가하는 방식으로 확장한다.

---

## 3. 최종 사용자 API(공개 DX) — 옵션은 2개만

### 3.1 API 형태
권장: 함수형 1-shot.

```ts
// 사용자는 configure 훅에서 단 한 번 호출
Scalar.setup(adapters, {
  documentTargets: 'all',
  httpTargets: 'all',
});
```

### 3.2 `documentTargets` (문서 생성 대상)
문서를 “어떤 어댑터/프로토콜/인스턴스”로부터 만들지 결정한다.

권장 스펙(최소):
- `'all'`
- `{ protocol: string; names?: string[] }[]` 형태의 matcher

예시:

```ts
documentTargets: 'all'

documentTargets: [
  { protocol: 'http', names: ['public-http', 'admin-http'] },
  { protocol: 'ws', names: ['chat-ws'] },
  { protocol: 'grpc' },
]
```

### 3.3 `httpTargets` (문서 호스팅 대상)
문서 URL을 실제로 “어느 HTTP 서버”에 붙일지 결정한다.

권장 스펙(최소):
- `'all'`
- `string[]` (http adapter name 리스트)

보안/의도 명확성 관점에서 권장 정책(협의 필요):
- 기본값을 두지 않고, `httpTargets`는 명시를 강제한다.
  - (개발 DX가 더 중요하면 기본값 `'all'`도 가능)

---

## 4. Scalar 내부 구조(모듈/컨트롤러 제거)

### 4.1 구성 요소
Scalar는 3단으로 분리한다.

1) DocumentBuilder
- 입력: metadata registry + 어댑터별 producer
- 출력: `Doc[]` (여러 문서)

2) HostBinder
- 입력: `Doc[]` + `httpTargets`
- 출력: 선택된 http 서버에 라우트 등록

3) Public Facade
- `Scalar.setup(adapters, { documentTargets, httpTargets })`

### 4.2 문서 모델(권장)
문서가 여러 개 제공되는 것을 전제로, 아래 3 엔드포인트 패턴을 권장한다.

- 인덱스: `/api-docs`
- UI: `/api-docs/{docId}`
- 스펙 JSON: `/api-docs/{docId}.json`

`docId`는 충돌 방지를 위해 규칙화한다.
- 예: `${type}:${protocol}:${name}`
  - `openapi:http:public-http`
  - `asyncapi:ws:chat-ws`

> NOTE: 현재 Scalar는 `path` 옵션을 가지고 있었으나, “옵션 2개만”을 위해 v1에서는 `/api-docs`로 고정한다.
> 필요하면 v2에서 `basePath`를 추가(기본값 포함)하되, 핵심 DX를 해치지 않는 방향으로 확장한다.

---

## 5. http-adapter가 제공해야 하는 내부 라우트 채널(undocumented)

### 5.1 왜 필요한가
현재 `BunnerHttpAdapter`는 미들웨어 체인만 제공하고, “외부 패키지가 임의 경로에 GET 라우트를 추가”할 방법이 없다.
Scalar는 모듈/컨트롤러 없이 `/api-docs*`를 호스팅해야 하므로, 라우트 등록 채널이 1개 필요하다.

### 5.2 요구사항
- 사용자에게는 문서/타입에서 노출하지 않는다.
- 외부 패키지(Scalar)만 접근할 수 있는 ‘사실상 비공개’ 형태로 제공한다.
- 최소 기능만 제공한다.
  - `GET path -> handler(req) => Response` 정도면 충분

### 5.3 추천 설계(심볼 기반 internal)

- `http-adapter` 내부에 심볼 키를 정의한다.
  - `const INTERNAL = Symbol.for('bunner:http:internal')`
- 어댑터 인스턴스에 `(adapter as any)[INTERNAL] = { route(...) }` 형태로 숨긴다.
- Scalar는 같은 `Symbol.for(...)`로만 해당 훅을 찾아서 라우트를 등록한다.

중요: 완전 차단은 불가능하지만,
- 타입에 노출하지 않고
- 문서에 노출하지 않으며
- 심볼 문자열을 외부에 안내하지 않음
으로 “야매 사용”을 사실상 억제한다.

---

## 6. 의존성 정책 및 에러 정책

### 6.1 의존성
- `@bunner/scalar`는 `@bunner/http-adapter`에 의존적이어야 한다(호스팅이 HTTP 기반이므로).
- 설치 전략(권장): `peerDependencies` 사용
  - 프로젝트에 `@bunner/http-adapter`가 없으면 설치 단계에서 경고/에러 유도
  - 런타임에서도 메시지를 명확히 제공

### 6.2 런타임 에러 정책
- `httpTargets`로 선택된 http 서버가 없으면 즉시 에러
  - 예: "Scalar: no HTTP adapter selected/found. Install/add @bunner/http-adapter and register an http adapter."
- 선택된 http 서버가 internal route 채널을 제공하지 않으면 에러
  - 예: "Scalar: selected http adapter does not support internal route binding (upgrade http-adapter)."

---

## 7. 마이그레이션 계획

### 7.1 단계별 진행(권장)

1) `@bunner/http-adapter`
- internal route 채널 추가(undocumented)
- 최소 `GET` 등록 지원

2) `@bunner/scalar`
- `Scalar.setup(adapters, { documentTargets, httpTargets })` 추가
- 기존 `ScalarModule/Controller/Service`는 **deprecated** 처리
  - 단, 사용 금지 원칙이므로 예제/문서에서 제거
  - 제거 시점은 major 버전에서 확정

3) `examples`
- `ScalarModule.forRoot(...)` 제거
- `AppModule.configure()`에서 `Scalar.setup(...)` 사용

4) (선택) 경계 정리
- `@bunner/common`의 HTTP 전용 `ErrorHandler`를 `http-adapter`로 이동 또는 이름/시그니처 변경
- `@bunner/core`의 `export * from '@bunner/common'` 재-export는 패키지 경계를 흐리므로 재검토

---

## 8. 검증(Verification)

### 8.1 시나리오
- HTTP adapter 2개(public/admin) 등록
- WS/GRPC/QUEUE adapter 각각 1개 이상 등록(실제 구현/목업 무관)
- Scalar 설정
  - `documentTargets: 'all'`
  - `httpTargets: ['public-http']` 또는 `'all'`

### 8.2 기대 결과
- 선택한 HTTP 서버(들)에서만 `/api-docs`가 노출된다.
- `/api-docs`는 문서 목록을 제공한다.
- `/api-docs/{docId}` 및 `/{docId}.json`이 정상 반환된다.
- http-adapter가 없거나 target이 잘못되면, 시작 시점에 명확한 에러가 발생한다.

---

## 9. 오픈 이슈(결정 필요)

1) `httpTargets` 기본값
- 안전 우선: 기본값 없음(명시 강제)
- DX 우선: 기본값 `'all'`

2) base path(`/api-docs`) 커스터마이즈
- v1: 고정
- v2: `basePath` 옵션 추가(옵션 증가)

3) 문서 생성 소스
- 현재는 `globalThis.__BUNNER_METADATA_REGISTRY__` 기반(OpenAPIFactory)
- WS/GRPC/QUEUE는 producer 확장 포인트를 어떻게 표준화할지

---

## 10. 용어 및 경계 정의(필수 규범)

이 프로젝트는 NestJS에서 애매했던 경계를 명확히 하기 위해 아래 규칙을 “공식 정의”로 채택한다.

### 10.1 Adapter / Plugin / Module 정의

#### Adapter (어댑터)
- **정의**: `BunnerAdapter`를 구현하고 `start(context)` / `stop()`으로 **런타임 리소스(서버/워커/리스너)를 직접 실행/중지**하는 단위
- **소유권**: 프로세스/네트워크/워커 등 “실행 단위”를 소유한다.
- **부착 지점**: `BunnerApplication.addAdapter()`로 등록되며, `AdapterCollection`을 통해 이름으로 선택된다.
- **예시**: HTTP, WS, gRPC, Queue 어댑터

#### Plugin (플러그인)
- **정의**: 어댑터 또는 컨테이너에 **설치(attach/setup)** 되어 기능을 확장하지만, 스스로 `BunnerAdapter`로서 서버/워커를 “실행”하지는 않는 단위
- **소유권**: 실행 단위를 소유하지 않고, 기존 실행 단위에 기능을 “붙인다”.
- **부착 지점**: 명확해야 한다.
  - 예: `Scalar -> (선택된) HTTP adapter(들)`
  - 예: `TypeORM -> Container(또는 App)`
- **예시**: 문서 호스팅, 메트릭/트레이싱 설치, DB 연결/Repository 설치

#### Module (모듈)
- **정의**: DI 스캐너가 읽는 **구성 그래프 단위**(controllers/providers/imports)
- **역할**: 앱 기능 조립(비즈니스 로직 구성)과 의존 주입 관계를 선언한다.
- **원칙**: 인프라를 “켜는 행위(연결/호스팅/마이그레이션 실행 등)”를 모듈이 숨기지 않는다.
- **예시**: Users/Posts/Billing 같은 도메인 모듈

### 10.2 판정 규칙(결정 트리)

아래 질문으로 분류가 결정된다.

1) `start/stop`으로 서버/워커/리스너를 직접 실행해야 하는가?
- Yes => Adapter

2) DI 그래프(controllers/providers/imports)를 구성하는가?
- Yes => Module

3) 기존 실행 단위(어댑터/컨테이너)에 설치되어 기능을 추가하는가?
- Yes => Plugin

> NOTE: 하나의 기능이 Module+Plugin처럼 보이면, “인프라를 켜는 부분”은 Plugin으로 분리하고,
> Module은 주입받아 사용하는 쪽만 남긴다.

### 10.3 금지 규칙(경계 강제)

- (금지) Plugin을 Module로 위장하여 `imports: [XxxModule.forRoot()]`로 인프라 설치를 숨기지 않는다.
  - 예: DB 연결/문서 호스팅/트레이싱 설치를 Module import로 해결하는 패턴 금지
- (금지) Adapter가 도메인 기능을 직접 포함하지 않는다.
  - Adapter는 transport 실행과 요청/메시지 전달에 집중한다.

### 10.4 이 문서 범위에서의 확정 분류

- Scalar: **Plugin**
  - 역할: 문서 생성 대상 선택(`documentTargets`) + HTTP 호스팅 대상 선택(`httpTargets`)
  - 부착 지점: 선택된 HTTP adapter(들)

- TypeORM 통합: **Plugin**
  - 역할: DataSource/Repository 설치, 연결 라이프사이클, (선택) 마이그레이션
  - 부착 지점: Container(또는 App)
  - 도메인 모듈은 TypeORM을 “설치”하지 않고 주입받아 사용만 한다.


