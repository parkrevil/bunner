# SPEC (인덱스)

이 문서는 Bunner의 SPEC 문서군을 탐색하기 위한 **인덱스**다.

- 이 파일은 각 문서의 역할/우선순위를 한 곳에서 확인할 수 있게 한다.

## SSOT 계층 (최종형)

이 레포에서 SSOT 계층은 다음 순서를 따른다.

```text
Level 0 (Top SSOT)
└─ ARCHITECTURE.md

Level 1 (Structural SSOT)
└─ STRUCTURE.md

Level 2 (Contract SSOT)
└─ docs/specs/spec.md (본 문서)
	└─ docs/specs/*.spec.md

Level 3 (Guidance / Process)
└─ ROADMAP.md 및 기타 가이드 문서
```

## 규범 용어

- MUST: 반드시 따라야 하며, 위반은 허용되지 않는다.
- MUST NOT: 절대 금지이며, 위반은 허용되지 않는다.
- SHOULD: 강력 권장이며, 예외가 필요하면 근거와 영향 범위를 함께 제시해야 한다.
- MAY: 선택 사항이다.

## 충돌 해결

- 문서 간 규칙이 충돌하면, SSOT 계층(ARCHITECTURE → STRUCTURE → SPEC 인덱스 → 개별 spec) 순서로 판정한다.
- 위 계층으로도 판정이 불가능하면, 추측하지 말고 즉시 중단한 뒤 사용자에게 확인을 요청한다.

## 세부 계약 문서 (Contract Specs)

- [AOT / AST](aot-ast.spec.md): 결정성, 리플렉션 금지, 정적 분석 불변조건
- [Module System](module-system.spec.md): 디렉토리 기반 자동 발견, 가시성 제어
- [Error Handling](error-handling.spec.md): Result/Panic 이원화, 표준 에러 프로토콜
- [DI (Dependency Injection)](di.spec.md): 정적 연결, 매니페스트 아키텍처
- [Transformer](transformer.spec.md): 제로 오버헤드 데이터 변환
- [Validator](validator.spec.md): 제로 디펜던시 검증 시스템
- [Adapter](adapter.spec.md): 프로토콜 격리 및 다중 어댑터 지원
