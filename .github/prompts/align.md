# Align (Spec/Docs/Code Conflicts)

## Required Reads (MUST)

- Preflight 8줄 + Handshake: [.github/prompts/README.md](README.md)
- 문서 위계/충돌 해결: [docs/10_FOUNDATION/SSOT_HIERARCHY.md](../../docs/10_FOUNDATION/SSOT_HIERARCHY.md)
- (해당 시) 구조/경계: [docs/20_ARCHITECTURE/ARCHITECTURE.md](../../docs/20_ARCHITECTURE/ARCHITECTURE.md)
- (해당 시) 계약/스펙: [docs/30_SPEC/SPEC.md](../../docs/30_SPEC/SPEC.md)
- (해당 시) 코딩 규율: [docs/40_ENGINEERING/STYLEGUIDE.md](../../docs/40_ENGINEERING/STYLEGUIDE.md)

## Prompt

1. Preflight 8줄 + Handshake 출력.
2. 충돌 항목을 “문서 경로 + 규정 문장(인용)”으로 목록화.
3. SSOT_HIERARCHY 규칙대로 상위 권위를 기계적으로 우선.
4. 불확실하면 즉시 STOP 후 질문.
