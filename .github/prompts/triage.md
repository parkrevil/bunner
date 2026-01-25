# Triage (Verify Failure)

## Required Reads (MUST)

- Preflight 8줄 + Handshake: [.github/prompts/README.md](README.md)
- 검증 절차/기준: [docs/40_ENGINEERING/VERIFY.md](../../docs/40_ENGINEERING/VERIFY.md)
- 코딩 규율: [docs/40_ENGINEERING/STYLEGUIDE.md](../../docs/40_ENGINEERING/STYLEGUIDE.md)
- 테스트 규율: [docs/40_ENGINEERING/TESTING.md](../../docs/40_ENGINEERING/TESTING.md)
- (해당 시) 데드 코드 정책: [docs/50_GOVERNANCE/DEAD_CODE_POLICY.md](../../docs/50_GOVERNANCE/DEAD_CODE_POLICY.md)

## Codebase Understanding Gate (MUST)

수정 전에 아래를 답변에 포함한다.

- 실패 로그의 “첫 실패 지점”과 관련 파일
- 관련 심볼의 사용처/호출 경로(최소 1개)
- 수정이 필요한 최소 원인 가설(추측 금지: 근거 링크/경로 필수)

## Verification (MUST)

- 검증은 `bun run verify`만 사용한다.

## Prompt

1. Preflight 8줄 + Handshake 출력.
2. 실패 원인 후보를 로그/Problems/usage 기반으로 좁힌다.
3. 최소 수정으로 해결한다.
4. `bun run verify` 재실행.
