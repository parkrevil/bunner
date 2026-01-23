# Docs Prompt Templates

## 0) 공통 Preflight 8줄
[README.md](README.md)의 Preflight 8줄을 먼저 출력하게 하세요.

---

## 1) 문서 전체 감사 (일관성/중복/모순/모호/흐름)

사용 시 권장 Tool Set: `bunner.audit.docs`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- docs/** 전체를 대상으로 일관성/중복/흐름/자연스러움/모순/모호 문제를 최대한 많이 찾아라.

Hard rules:
- 해결책/수정안 제시는 "문제 목록" 제출 이후에만 가능.
- 문서 의미(SSOT 의미) 변경이 필요하다고 판단되면: 승인 토큰 요청 포맷(유형/현재 상황/요청 범위/대안/리스크)으로 요청하고 STOP.
- 추정 금지. 각 항목은 근거(문서 경로 + 섹션 제목/문장 인용)를 포함.

Output format (고정):
1) Duplicates (중복)
- <문서 A 섹션> ↔ <문서 B 섹션>: 중복 요지 1줄
2) Contradictions (모순)
- Statement A: <boolean 형태로 재기술>
- Statement B: <boolean 형태로 재기술>
- Why conflict: 1줄
3) Ambiguity (모호)
- <문장>: 무엇이 판정 불가능한지 1줄
4) Flow/Navigation (흐름/내비게이션)
- <개선 포인트>: 최소 변경 제안 1줄
5) Summary
- 승인 필요 항목 수 / 승인 불필요 항목 수
```

---

## 2) 문서 개선(의미 불변)

사용 시 권장 Tool Set: `bunner.docs`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- <문서 경로>의 가독성과 판정 가능성을 개선하되, 의미(SSOT)를 변경하지 않는다.

Scope:
- 변경 파일: <문서 경로들(최소)>만.

Rules:
- docs/50_GOVERNANCE/DOCS_WRITING.md를 따른다.
- MUST/MAY/MUST NOT 근처에 모호 표현(예: 적절히/충분히/권장 등)을 남기지 않는다.
- 새 용어를 도입하면 정의 위치를 명시한다(문서 내 Definitions 또는 glossary 등).

Deliver:
- 변경된 섹션/헤딩 목록
- 핵심 문장 변경 3개(왜 더 판정 가능해졌는지 1줄)
- 의미 변경 여부: 없음(확인)
```

---

## 3) SSOT 의미 변경이 필요하다고 판단될 때(수정 금지, 승인 요청)

사용 시 권장 Tool Set: `bunner.docs`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Situation:
- SSOT 의미 변경이 필요하다고 판단했다. (예: 규칙 충돌/비판정/운영 불가능)

Action:
- 아래 승인 요청 포맷으로만 요청하고 STOP한다.

Approval request (MUST include 5 fields):
1) 유형: SSOT 변경
2) 현재 상황(1~2줄):
3) 요청 범위(파일/패키지):
4) 대안: none | <대안 목록>
5) 리스크(영향 범위):

STOP.
```
