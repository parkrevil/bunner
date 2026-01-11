# GOVERNANCE

이 문서는 “사람이 결정하고, 기계가 집행한다”는 전제에서
거버넌스의 판정 규칙과 승인 아티팩트(Decision Artifact)를 정의한다.

## 역할 (Normative)

- GOVERNANCE는 **규칙을 정의**한다.
- 집행(enforcement)은 **E0(AGENTS.md) / CI**가 수행한다.
- 사람의 준수(compliance)는 가정하지 않는다.

## 핵심 불변조건 (Normative)

- 사람 개입이 필요한 모든 결정(승인/거절/선택)은 **승인 아티팩트**로만 시스템에 반영된다.
- 승인 아티팩트가 없으면 변경은 **무효**이며, 에이전트/CI는 **차단**해야 한다.

## 적용 범위

- 레포에 반입되는 모든 변경(코드/문서/설정/의존성/자동화)

## 권위/우선순위

- 문서 권위 위계는 [docs/10_FOUNDATION/SSOT_HIERARCHY.md](../10_FOUNDATION/SSOT_HIERARCHY.md)를 따른다.
- 본 문서는 L5로서 “승인/판정/위생 규칙”을 정의하며, 상위 계층(L1~L4)에 종속된다.

## 승인 아티팩트 (Decision Artifact)

승인 아티팩트는 아래 중 하나여야 한다(MUST). 이 목록 밖의 행위/문장은 승인으로 인정되지 않는다(MUST NOT).

1. **대화 기반 승인(Agent Approval Token)**
   - 사용자 메시지가 아래 토큰 중 하나와 정확히 일치하면 승인으로 판정한다(MUST).
   - 허용 토큰: `Y`, `OK`, `승인`, `진행해`, `ㅇㅇ`

2. **GitHub PR 승인 상태(PR Approval State)**
   - PR이 최소 1개 이상의 승인 리뷰(Approved)를 가지면 승인으로 판정한다(MUST).

## 승인이 필요한 변경 유형 (Decision Required)

아래 유형의 변경은 승인 아티팩트가 없으면 **반드시 차단**해야 한다(MUST).

- 범위 확장(Scope Override): 사용자가 명시하지 않은 패키지/영역 변경
- SSOT 변경: L1~L5 문서의 규칙/불변식/정책 의미 변경
- Public Facade 변경: `packages/*/index.ts`의 export 변경
- 아키텍처 변경: 패키지 경계/의존 방향 변경

## 에이전트 승인 요청 포맷 (Normative)

승인이 필요한 상황에서, 에이전트는 아래 5개 필드를 포함한 요청을 출력해야 한다(MUST).

1. 유형
2. 현재 상황(1~2줄)
3. 요청 범위(파일/패키지 목록)
4. 대안(없으면 `none`)
5. 리스크(영향 범위)

## 위반 조건 (Violation Conditions)

- 승인 필요 변경을 승인 아티팩트 없이 수행함
- 승인 아티팩트를 추론/해석(문맥)으로 판정하려 함

## 집행 (Enforcement)

- E0/에이전트: 위반 감지 시 즉시 중단(STOP)한다.
- CI: 위반 감지 시 빌드를 실패(FAIL)시키고 병합을 차단한다.
