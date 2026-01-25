# Read (Fallback)

## Required (MUST)

- Preflight 8줄 + Handshake: [.github/prompts/README.md](README.md)
- 문서 권위 위계: [docs/10_FOUNDATION/SSOT_HIERARCHY.md](../../docs/10_FOUNDATION/SSOT_HIERARCHY.md)

## Prompt

아래 규칙을 기계적으로 따른다.

1. Preflight 8줄 + Handshake를 먼저 출력한다.
2. 질문/요청을 “코드 변경 없음(읽기/설명)”으로 고정한다.
3. 불확실하면 추측하지 말고 STOP IF UNCERTAIN 트리거로 중단하고 질문한다.
4. 답변에는 근거가 된 파일 경로를 함께 제시한다.
