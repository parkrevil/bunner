# Agent Instructions (Entry Point)

이 저장소의 정본 규칙은 [AGENTS.md](../AGENTS.md) (E0)다.

---

## 빠른 링크

1. 정본(E0): [AGENTS.md](../AGENTS.md)
2. 문서 지도(내비게이션 SSOT): [docs/00_INDEX.md](../docs/00_INDEX.md)
3. 문서 권위 위계(SSOT): [docs/10_FOUNDATION/SSOT_HIERARCHY.md](../docs/10_FOUNDATION/SSOT_HIERARCHY.md)
4. 프롬프트 라이브러리(운영 레이어): [.github/prompts/README.md](prompts/README.md)
5. Tool Sets 정의(참고): [.vscode/toolsets.jsonc](../.vscode/toolsets.jsonc)

---

## Notes

- 프롬프트 파일(.github/prompts/\*\*)은 반복 가능한 운영 템플릿이며, 규칙의 정본은 아니다.
- 문서(SSOT) 변경/공개 Facade 변경/deps 변경은 승인 아티팩트가 없으면 금지다.
  (정본: [docs/50_GOVERNANCE/OVERVIEW.md](../docs/50_GOVERNANCE/OVERVIEW.md))

---

## Mandatory Start (MUST)

1. Preflight 8줄 + Handshake를 항상 먼저 출력한다.

- 정본: [.github/prompts/README.md](prompts/README.md)

2. 요청을 아래 Routing 규칙으로 반드시 분류하고, 대응되는 Prompt + Toolset을 선택한다.

- 어떤 경우에도 "해당 프롬프트/툴셋 없음" 상태를 만들지 않는다.

## Routing (MUST, 미매칭 0)

모르면 무조건 fallback:

- Default fallback: `prompts/read.md` + `bunner.read`

분기:

- Plan 작성/전이: `prompts/plan.md` + `bunner.plan`
- Docs 작업: `prompts/docs.md` + `bunner.docs`
- Spec 작업: `prompts/spec.md` + `bunner.spec`
- Align(충돌 정리): `prompts/align.md` + `bunner.align`
- Implement(코드 변경): `prompts/implement.md` + `bunner.implement`
- Triage(verify 실패): `prompts/triage.md` + `bunner.triage`
- Refactor(게이트): `prompts/refactor.md` + `bunner.refactor.gate`
- Audit: `prompts/audit.md` + `bunner.audit.docs` 또는 `bunner.audit.rules`
- Task run(실행만): `prompts/task-run.md` + `bunner.implement`
