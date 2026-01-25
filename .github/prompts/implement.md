# Implement (Code Change)

## Required Reads (MUST)

- Preflight 8줄 + Handshake: [.github/prompts/README.md](README.md)
- 코딩 규율: [docs/40_ENGINEERING/STYLEGUIDE.md](../../docs/40_ENGINEERING/STYLEGUIDE.md)
- 테스트 규율: [docs/40_ENGINEERING/TESTING.md](../../docs/40_ENGINEERING/TESTING.md)
- 의존성 정책: [docs/40_ENGINEERING/DEPENDENCIES.md](../../docs/40_ENGINEERING/DEPENDENCIES.md)
- 데드 코드 정책: [docs/50_GOVERNANCE/DEAD_CODE_POLICY.md](../../docs/50_GOVERNANCE/DEAD_CODE_POLICY.md)
- (해당 시) 구조/경계: [docs/20_ARCHITECTURE/ARCHITECTURE.md](../../docs/20_ARCHITECTURE/ARCHITECTURE.md)
- (해당 시) 계약/스펙: [docs/30_SPEC/SPEC.md](../../docs/30_SPEC/SPEC.md)

## Codebase Understanding Gate (MUST)

코드 변경 전에 아래 증거를 먼저 만든다(답변에 포함).

- 변경 대상 파일/심볼(함수/클래스) 목록
- 엔트리포인트(예: CLI, adapter, public API)와 호출 경로 요약
- `list_code_usages`/검색으로 확인한 사용처 요약
- 영향 범위(패키지/테스트/런타임)와 리스크

## Verification (MUST)

- 검증은 `bun run verify`만 사용한다.

## Prompt

아래 순서로 수행한다.

1. Preflight 8줄 + Handshake 출력.
2. Codebase Understanding Gate 증거를 먼저 수집/요약.
3. 최소 변경으로 구현.
4. `bun run verify` 실행 및 실패 시 원인 최소 수정.
5. 변경 파일/핵심 의도/검증 결과를 간단히 보고.
