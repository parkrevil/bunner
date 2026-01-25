# Refactor (Gate)

## Required Reads (MUST)

- Preflight 8줄 + Handshake: [.github/prompts/README.md](README.md)
- 코딩 규율: [docs/40_ENGINEERING/STYLEGUIDE.md](../../docs/40_ENGINEERING/STYLEGUIDE.md)
- 테스트 규율: [docs/40_ENGINEERING/TESTING.md](../../docs/40_ENGINEERING/TESTING.md)
- 데드 코드 정책: [docs/50_GOVERNANCE/DEAD_CODE_POLICY.md](../../docs/50_GOVERNANCE/DEAD_CODE_POLICY.md)

## Codebase Understanding Gate (MUST)

리팩토링 전 아래를 먼저 제시한다.

- “동작 유지”의 기준(바뀌면 안 되는 I/O, 계약, 에러 형태)
- 변경 대상 심볼/파일 및 사용처 요약
- 단계별 게이트(작게 쪼개서 검증) 계획

## Verification (MUST)

- 검증은 `bun run verify`만 사용한다.

## Prompt

1. Preflight 8줄 + Handshake 출력.
2. Codebase Understanding Gate 완료.
3. 작은 단위로 리팩토링.
4. 각 게이트에서 `bun run verify`로 확인.
