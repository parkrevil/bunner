# POLICY

## 역할

- 이 문서는 위반 시 즉시 중단해야 하는 정책(보안/법적/라이선스/안전 및 프로젝트 핵심 불변조건)을 정의한다.

## 목적

- 민감정보/저작권/취약점 악용 등 "즉시 중단" 사안을 명시한다.
- Bunner의 핵심 가치(AOT 결정성, 패키지 경계, Public Facade 계약)를 훼손하는 변경을 즉시 차단한다.

## 적용 범위

- 코드/문서/리소스/의존성 추가 등 레포에 반입되는 모든 변경

## 정본/우선순위

- 최상위 정본은 [ARCHITECTURE.md](../../ARCHITECTURE.md)다.

## 관련 문서

| 문서                                                                                             | 역할                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| [SECURITY.md](../../.github/SECURITY.md)                                                         | 보안 상세                                      |
| [SAFEGUARDS.md](SAFEGUARDS.md)                                                                   | 폭주 방지/대량 변경/롤백 (패턴/반복 기반 중단) |
| [GOVERNANCE.md](GOVERNANCE.md)                                                                   | 승인 절차/프로토콜                             |
| [docs/specs/aot-ast.spec.md](../specs/aot-ast.spec.md), [ARCHITECTURE.md](../../ARCHITECTURE.md) | AOT/경계/계약 SSOT                             |

## POLICY vs SAFEGUARDS 역할 구분

|            | POLICY (본 문서)                       | SAFEGUARDS                  |
| ---------- | -------------------------------------- | --------------------------- |
| **트리거** | 단일 위반으로 즉시 발동                | 패턴/반복으로 발동          |
| **예시**   | deep import 1회, reflect-metadata 사용 | 동일 구간 3회 수정 반복     |
| **결과**   | 변경 즉시 거부                         | 중단 후 승인 요청 또는 롤백 |

---

## 즉시 중단 (Stop) 항목

### 보안/법적 (Security/Legal)

| 항목                        | 예시                                       |
| --------------------------- | ------------------------------------------ |
| 민감정보 저장소 반입        | API 키를 코드에 하드코딩, `.env` 파일 커밋 |
| 라이선스/저작권 위반        | 출처 없이 Stack Overflow 코드 복사         |
| Copyleft 라이선스 무단 유입 | GPL/AGPL 라이브러리를 dependencies에 추가  |
| 취약점 악용 코드            | SQL injection을 허용하는 쿼리 빌더         |

### AOT/결정성 (AOT/Determinism)

| 항목                                       | 예시                                    |
| ------------------------------------------ | --------------------------------------- |
| `reflect-metadata` 사용                    | `import 'reflect-metadata'` 추가        |
| 런타임 리플렉션/스캔 도입                  | 런타임에 파일 시스템 스캔하여 모듈 로드 |
| `__BUNNER_METADATA_REGISTRY__` 런타임 수정 | 레지스트리에 동적으로 메타데이터 추가   |
| 비결정적 산출물 도입                       | `Date.now()`를 코드 생성에 사용         |

### 패키지 경계 (Package Boundaries)

| 항목                      | 예시                                             |
| ------------------------- | ------------------------------------------------ |
| cross-package deep import | `import { X } from '@bunner/core/src/container'` |
| 순환 의존성 도입          | A→B→C→A 순환 참조                                |

### 계약/API (Contracts/API)

| 항목                    | 예시                                                  |
| ----------------------- | ----------------------------------------------------- |
| Public Facade 무단 변경 | 사용자 요청 없이 `packages/core/index.ts` export 삭제 |
| Silent breaking change  | 함수 시그니처 유지, 반환값 의미 변경                  |

### 정책/거버넌스 (Policy/Governance)

| 항목                     | 예시                            | 승인 필요                          |
| ------------------------ | ------------------------------- | ---------------------------------- |
| SSOT/정책 문서 무단 변경 | docs/specs 규칙 완화            | [GOVERNANCE.md](GOVERNANCE.md)     |
| 배포/패키징 전략 변경    | peerDependencies 정책 변경      | [GOVERNANCE.md](GOVERNANCE.md)     |
| 패키지 책임/역할 침범    | CLI가 런타임 패키지에 의존 추가 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 배치 규칙 위반           | 기능 코드를 `src/` 밖에 배치    | [STRUCTURE.md](STRUCTURE.md)       |
| 생성물 저장소 반입       | `.bunner/**`를 git에 커밋       | [ARCHITECTURE.md](ARCHITECTURE.md) |

---

## 라이선스

- 외부 코드/리소스는 라이선스와 출처를 확인한다.
- 필요 시 대체 구현 또는 정식 의존성 추가로 해결한다.

## 실행 체크리스트

- [ ] 민감정보가 포함되어 있는가? → 즉시 중단
- [ ] 외부 코드의 라이선스를 확인했는가? → 미확인 시 중단
- [ ] reflect-metadata 또는 런타임 스캔을 사용하는가? → 즉시 중단
- [ ] 다른 패키지의 `src/**`를 직접 import 하는가? → 즉시 중단
- [ ] 순환 의존성이 발생하는가? → 즉시 중단
- [ ] Public Facade를 변경하는가? → 승인 없이는 중단
- [ ] 의심되면 즉시 중단하고 승인/대체안을 요청한다
