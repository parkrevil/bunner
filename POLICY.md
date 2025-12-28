# POLICY

## 역할

- 이 문서는 위반 시 즉시 중단해야 하는 정책(보안/법적/라이선스/안전 및 프로젝트 핵심 불변조건)을 정의한다.

## 목적

- 민감정보/저작권/취약점 악용 등 “즉시 중단” 사안을 명시한다.
- Bunner의 핵심 가치(AOT 결정성, 패키지 경계, Public Facade 계약)를 훼손하는 변경을 즉시 차단한다.

## 적용 범위

- 코드/문서/리소스/의존성 추가 등 레포에 반입되는 모든 변경

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.

## 관련 문서

- 보안 상세: [SECURITY.md](SECURITY.md)
- 폭주 방지/대량 변경/롤백: [SAFEGUARDS.md](SAFEGUARDS.md)
- 승인/중단(거버넌스): [GOVERNANCE.md](GOVERNANCE.md)
- AOT/경계/계약 SSOT: [SPEC.md](SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md)

## 즉시 중단 (Stop) 항목

- 민감정보(키/토큰/비밀번호/개인정보) 저장소 반입
- 라이선스/저작권 위반 가능성이 있는 코드/리소스 무단 포함
- Copyleft/viral 라이선스(GPL, AGPL 등)가 명시적 승인 없이 런타임/배포 경로에 유입되는 변경
- 취약점 악용을 돕는 코드 생성/배포

- `reflect-metadata` 사용 또는 런타임 리플렉션/스캔 기반 설계 도입
- `__BUNNER_METADATA_REGISTRY__`를 런타임/외부에서 수정/패치/주입하려는 시도
- AOT/AST 결정성을 깨뜨리는 비결정적 입력/순서 의존 도입
- 빌드/코드 생성 과정에서 시간/랜덤/머신 상태/네트워크 결과에 의존하는 비결정적 산출물 도입

- cross-package deep import 도입(다른 패키지의 `src/**` 직접 import)
- 순환 의존성(Circular Dependency) 도입
- Public Facade(패키지 엔트리포인트) 계약을 사용자의 명시 없이 변경
- 타입은 유지되지만 public contract의 의미/행동을 변경하는 Silent breaking change를 사용자 승인 없이 도입

- SSOT/정책/자동화 개입 범위 조정을 승인 없이 시도(승인 기준: [GOVERNANCE.md](GOVERNANCE.md))

- 배포/패키징 전략(번들링, peerDependencies vendoring 포함)을 명시적 정책과 승인 없이 도입/변경
  - 승인 기준: [GOVERNANCE.md](GOVERNANCE.md)

- 패키지의 책임/소유권(역할)을 침범하거나 변경하는 작업을 사용자 승인 없이 진행
  - SSOT: [ARCHITECTURE.md](ARCHITECTURE.md)

- 배치(Placement) 규칙 위반 또는 경계 침식이 필요한 작업을 승인 없이 진행
  - 예: 기능 코드를 `src/` 밖에 추가/유지, feature 경계를 직접 침범하는 import
  - SSOT: [STRUCTURE.md](STRUCTURE.md), [ARCHITECTURE.md](ARCHITECTURE.md)

- 생성물(예: `.bunner/**`, `dist/**`)을 명시적 요구 없이 저장소에 반입
  - SSOT: [ARCHITECTURE.md](ARCHITECTURE.md)

## 라이선스

- 외부 코드/리소스는 라이선스와 출처를 확인한다.
- 필요 시 대체 구현 또는 정식 의존성 추가로 해결한다.

## 실행 체크리스트 (가이드)

- 의심되면 즉시 중단하고 승인/대체안을 요청한다.
- 출처/라이선스 확인 없이 외부 코드를 반입하지 않는다.
