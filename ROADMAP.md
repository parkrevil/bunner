# ROADMAP

Bunner 프레임워크의 개발 방향과 목표, 필요한 패키지를 정하고 초안을 기술한다.

## 목표

Bunner 는 VISION.md 를 핵심 가치관으로 둔다.

- Bun 환경에서만 동작하는 프레임워크를 구축한다.
- 장황한 설명 없이 구조와 코드가 프레임워크를 설명할 수 있어야 한다.
- 사용자의 러닝커브를 최소화 해야한다.
- 쉬운 방법 보단 단순한 방법을 제공한다.
- 명확하고 직관적이며 투명한 사용성을 제공한다.
- 백엔드 프레임워크의 뜨거운 감자를 고려하여 개발자들의 고충을 해결하기 위해 최선을 다한다.
- reflect-metadata 를 사용하지 않는다.

## 메모

- bunfig.toml 사용 및 최적화 검토
- bun:bundle 의 feature 사용 검토
  - 사용자가 사용한 feature 만 골라내서 CLI 에서 알아서 Build 스크립트를 최적화 할 수 있을까?

## Common 기능 및 DX

- Angular 및 NestJS 의 아키텍처 및 DX
- 고속
- 가벼움
- AST, AOT
- DI
- Pre-built Pipeline
- Adapter
- Middleware
- Guard
- Error Filter
- Result<T, E>
- Transformer
- Validator
- MCP
- Cluster Manager
- Like Nestjs Devtools
- Rust FFI Adapter Core

## DI

- constructor parameter injection 사용하지 않음
- inject() or inject(Injectable Class) or inject(token)
- @Injectable({scope: 'singleton' | 'request' | 'transient'}) default 'singleton'
- Adapter 마다 Parameter Injection 을 지원할 수 있음

  ```typescript
  // HTTP Adapter
  @Controller()
  class SomeController {
    get(@Params() params: SomeParams, @Body() body: SomeBodyDto) {}
  }
  ```

## DTO(Data Transfer Object)

DTO 라는 개념 자체는 사용되겠지만 용어가 모호함. 사용자에게 프레임워크 권장 용어를 어필할 필요가 있음

- HTTP: Body, Query, Params, Headers, Response
  - CreateUserBody, CreateUserResponse, ListQuery, UserIdParams
- gPRC: Request, Response
  - CreateUserRequest, CreateUserResponse
- WS: Payload, Response, Message
  - CreateUserPayload, CreateUserResponse, StartMaintenanceMessage
- Queue: Message, Event
  - CreateUserMessage, CreateUserEvent
- TCP, UDP, QUIC: Packet
  - CreateUserPacket

## Transformer

class-transformer 개조. 사용자에겐 class-transformer 의 DX를 제공. Expose 가 기본

### CLI

- **Serializer Generator**
  - 빌드 타임에 AST를 분석하여 **즉시 실행 가능한 직렬화 함수** 생성
  - **String Template Optimization:**
    - 변하지 않는 JSON 구조(Key, Bracket, Comma)는 `const` 문자열로 사전 할당
    - 런타임에는 문자열 접합(`Concatenation`) 연산만 수행하여 메모리 할당 최소화
- **Deserializer Generator**
  - JSON.parse 후 `instance.prop = plain.prop` 형태의 **1:1 하드코딩 매핑 함수** 생성
  - @Type, @Transform 등의 메타데이터를 분석하여 변환 코드를 인라인으로 주입

### Common

데코레이터와 transformer 옵션, 데코레이터 옵션만 제공

@Type 은 고려해야함. AOT 에서 인지할 수 있는 Native 타입을 @Type(() => Number) 식으로 사용하게끔 해야하는가?

- @Expose
- @Exclude
- @Type
- @Transform

### Core

아래의 기능을 core 에서 제공하는건 깔끔하지만 CLI 는 글로벌로도 설치되기 때문에 Core를 의존해야하는지 고려해야한다.

- **Optimized Escape Function:**
  - CLI가 생성한 Serializer 코드가 문자열 값을 안전하게 합칠 때 호출하는 **초고속 이스케이프 헬퍼 함수** 제공
- **Complex Type Converters:**
  - Date, BigInt, Buffer 등 단순 문자열 합치기로 불가능한 타입들을 변환하는 **공통 변환 함수** 제공 (생성된 코드의 중복 방지)

## Validator

`class-validator`의 친숙한 DX(Decorator)를 유지하되, 런타임에는 외부 라이브러리(Zod 등) 의존성 없이 순수 JS 로직으로 동작한다.

외부 검증 라이브러리(Zod, Joi 등)를 런타임에 포함하지 않음 (Zero Runtime Dependency)

**Return Result, Don't Throw:**
<br>
Validator는 예외를 던지지 않고 `Result<T, ValidationFailure>`를 리턴한다.

### CLI

- **Raw Code Optimization:**
  - `class-validator`의 느린 런타임 루프와 리플렉션 비용 제거
  - `typeof`, `val.length`, `regex.test()` 등 네이티브 연산자만을 사용하여 분기 예측(Branch Prediction) 최적화
- **Schema-less & Zero-Overhead:**
  - 중간 스키마 객체를 생성하지 않고, 검증 실패 시 즉시 `ValidationFailure` POJO를 구성하여 리턴하는 코드 생성

### Common

- **Marker Decorators**
  - 로직 없이 메타데이터만 마킹하는 데코레이터 제공 (`@IsString`, `@IsEmail`, `@ValidateNested` 등)
- **Lightweight Interfaces (POJO)**
  - `ValidationFailure`: 스택 트레이스가 없는 순수 데이터 객체. `code: 'VALIDATION_ERROR'`와 `violations` 배열을 포함.
  - `FieldViolation`: 개별 필드의 실패 원인(`reason`), 메시지(`message`), 입력값(`value`)을 담는 구조체 정의.

### Core

- **Validation Utils**
  - **Shared Regex Patterns:** Email, UUID, IP 등 복잡한 정규식 상수를 제공하여 생성된 코드의 중복 방지.
- **Pluggable Formatter Architecture**
  - 프레임워크 코어는 `ValidationFailure` 데이터만 전달하며, 최종 응답 형태는 관여하지 않음.
  - **Adapter Integration:** 각 어댑터(HTTP, gRPC)가 `Formatter`를 주입받아 엔터프라이즈 표준에 맞는 응답 스키마(HTTP 400 Body, gRPC Status)로 변환하도록 설계.

## Adapter

- 프로토콜별 어댑터
- Multi Adapter per 1 App(같은 어댑터 중복 가능)

## CLI - @bunner/cli

- Compiler, AST, AOT
  - Manifest 생성
    - 개발용 Manifest
      - 최대 정보량
    - 배포용 Manifest
      - 최소 정보량
- 빌드 타임에 최대한 친절한 에러 메시지 제공
  - What, Where, Why, How

### 명령어

- bunner dev
  - 개발 서버 실행
  - MCP 를 위해 Manifest 를 최대 정보량으로 생성
- bunner build
  - 빌드
  - 운영용 결과물을 생성하기에 Manifest 를 최소 정보량으로 생성
- bunner firebet
  - 불빠따로 에이전트 혼내는용
  - 코드 스타일 검사
  - Typescript 문법 최적화 검사
  - bunner-firebet.config.json
    - 검사 규칙 정의(eslintconfig 와 비슷하게)
  - --fix: 가능하면 자동 수정
  - --audit: 보안 취약점이나 성능 저하 코드 검출
- bunner new
  - 프로젝트 생성
- bunner init
  - 현재 디렉토리에 프로젝트 생성(기능은 bunner new 와 동일)
- bunner upgrade
  - 코어 및 디펜던시 업그레이드
- bunner info
  - OS, Bun 버전, Bunner 버전, 사용 중인 어댑터 목록 출력
- bunner version
  - 버전 확인
- bunner graph
  - DI 의존성 그래프 출력
  - --json: json 파일로 생성
  - --svg: svg 파일로 생성
- bunner generate, g
  - controller, c
  - service, s
  - middleware, mw
  - guard, g
  - pipe, p
  - filter, f
  - error-filter, e
  - module, m

## Common - @bunner/common

## Core - @bunner/core

- Error Filter
  - Nestjs Exception Filter 와 거의 유사
  - Result<T, E> 방식에서 에러필터가 필요할까? 단순 SystemErrorHandler 로 처리하는 것은 어떨까?

    ```typescript
    @ErrorFilter(MongoError, SomeError)
    export class ErrorFilter implements ErrorFilterInterface {
      catch(error: Error, ctx: Context): Result<bool, string | number | boolean | Error> {
        if (error instanceof MongoError) {
          return error(new Error('mongo error'));
        }

        return error(error);
      }
    }
    ```

- Middleware

  ```typescript
  export function cors(options?: CorsOptions): {
    return async (ctx: Context): Result<bool, string | number | boolean | Error> {
      if (a != 1) {
        return error(new Error('cors error'));
      }

      if (b != 2) {
        return error('error');
      }

      return ok(true);
    }
  }
  ```

- Guard
  - Nestjs Guard 와 비슷
- Pipe
  - Nestjs Pipe 와 비슷

## Logger - @bunner/logger

- Bun.stringWidth 사용 검토

## Docs - @bunner/docs

## HTTP Adapter - @bunner/http-adapter

## Websocket Adapter - @bunner/websocket-adapter

## Socket IO Adapter - @bunner/socket.io-adapter

## Redis Adapter - @bunner/redis-adapter

## Drizzle ORM - @bunner/drizzle-orm

## Testing - @bunner/testing
