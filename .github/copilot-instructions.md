# Copilot Instructions

This repository is governed by the following entry document:

- [AGENTS.md](../AGENTS.md)

Copilot must read and follow the rules defined in that file.

---

## Quick References

1.  **Mandatory Guide**: Always follow [AGENTS.md](../AGENTS.md)
2.  **Documentation Index**: [docs/00_INDEX.md](../docs/00_INDEX.md)
3.  **Authority Model**: [docs/10_FOUNDATION/SSOT_HIERARCHY.md](../docs/10_FOUNDATION/SSOT_HIERARCHY.md)

---

## Agent Workflow Trigger (계획 시에만 .agent 적용)

아래 조건을 만족하면, `.agent` 워크플로우/템플릿을 적용한다.

- 사용자가 명시적으로 “계획(Plan) 작성”을 요청한 경우

그 외(질문/설명/분석/토론, 또는 파일 변경 요청 포함)는 `.agent` 절차 없이 진행할 수 있다.

- Workflow 정본: [../.agent/workflow.md](../.agent/workflow.md)
- Plan 템플릿 정본: [../.agent/template.md](../.agent/template.md)

---

## Technical SSOT Reference

| Area             | Document Path                                               |
| :--------------- | :---------------------------------------------------------- |
| **Foundation**   | `docs/10_FOUNDATION/SSOT_HIERARCHY.md`, `INVARIANTS.md`     |
| **Architecture** | `docs/20_ARCHITECTURE/ARCHITECTURE.md`, `STRUCTURE.md`      |
| **Contracts**    | `docs/30_SPEC/SPEC.md`, `docs/30_SPEC/*.spec.md`            |
| **Engineering**  | `docs/40_ENGINEERING/STYLEGUIDE.md`, `TESTING.md`           |
| **Governance**   | `docs/50_GOVERNANCE/OVERVIEW.md`, `POLICY.md`, `COMMITS.md` |
