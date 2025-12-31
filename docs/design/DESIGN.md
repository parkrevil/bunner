# DESIGN RATIONALE

## Why Determinism

예측 불가능한 런타임 동작은
성능 튜닝과 장애 대응을 어렵게 만든다.

결정론적 구조는 시스템을 단순하게 만들지는 않지만,
이해 가능하게 만든다.

---

## Why Functional DI

Constructor Injection은
인스턴스 생성과 로직을 강하게 결합시킨다.

함수형 DI는 이 둘을 분리하여
테스트와 추론을 단순하게 만든다.

---

## Why Dual Error Model

모든 실패를 예외로 취급하면
실패의 성격이 사라진다.

Result 기반 실패 모델은
비즈니스 흐름을 명시적으로 만든다.

---

## Why Protocol-Agnostic Core

프로토콜은 진화하지만,
비즈니스 규칙은 오래 지속된다.

코어는 변하지 않는 것을 담당해야 한다.
