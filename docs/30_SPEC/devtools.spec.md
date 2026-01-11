# DevTools Specification

> 본 문서는 L3 SPEC이며, 특정 기능에 대한 구현 계약(Implementation Contract)만을 정의한다.
> L1 불변식 및 L2 아키텍처 경계를 전제로 하며, 충돌 시 상위 문서가 우선한다.

## Purpose

본 SPEC은 개발 중 모니터링/시각화 도구(DevTools)의 기능 경계 및 비개입(non-intrusive) 계약이 유효한 구현으로 성립하는 조건을 정의한다.

## Scope & Boundary

본 SPEC은 DevTools가 관측/시각화/진단을 제공하면서 실행 의미론을 변경하지 않는 조건을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- MCP Server의 분석/변경 명령 표면 → mcp-server.spec.md에서 판정된다.
- 로깅 이벤트의 구조 → logger.spec.md에서 판정된다.

## Definitions

- Non-intrusive: DevTools가 활성화되어도 실행 결과/경로/판정이 바뀌지 않는 성질.

## Invariants

- DevTools는 관측 도구이며, 실행 경로를 재구성하는 지능을 포함하지 않는다.

## MUST

- DevTools 활성화 여부에 따라 실행 의미론이 변하지 않아야 한다.

## MUST NOT

- DevTools는 실행 경로를 변경하거나, 구조 판정을 대체해서는 안 된다.
- DevTools는 사용자의 코드/산출물을 암묵적으로 수정해서는 안 된다.

## Handoff

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

## Violation Conditions

- DevTools 활성화가 실행 결과/경로에 영향을 주는 경우
- 데이터 소스가 모호하여 추측이 필요한 경우

## Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 본 SPEC은 무효로 판정된다.
