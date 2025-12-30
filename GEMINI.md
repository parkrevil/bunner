# Antigravity (Gemini) Agent Instructions

이 문서는 Antigravity 에이전트 전용 진입점이다.

## 필독 문서

**[AGENTS.md](AGENTS.md)를 반드시 읽고 모든 규칙을 따른다(MUST).**

AGENTS.md가 공용 SSOT이며, 이 문서는 Antigravity 특화 규칙만 정의한다.

## Antigravity 특화 규칙

### 도구 사용

- **browser_subagent**: 브라우저 작업 시 사용
- **generate_image**: 이미지 생성 시 사용
- **view_file**, **replace_file_content** 등: 파일 작업

### Artifact 저장

- 계획/워크스루는 `brain/<conversation-id>/` 디렉토리에 저장
- 복잡한 작업 시 실행계획을 artifact로 저장 가능

### 범위 제한 강조

- 사용자 요청 범위 내에서만 작업한다(MUST).
- 범위 확장 필요 시 **반드시 승인 요청**.

## 빠른 참조

| 상황            | 확인 문서                          |
| --------------- | ---------------------------------- |
| 집행 규칙 전체  | [AGENTS.md](AGENTS.md)             |
| 최상위 불변조건 | [SPEC.md](SPEC.md)                 |
| 불변의 법칙     | [INVARIANTS.md](INVARIANTS.md)     |
| 패키지 경계     | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 코딩 스타일     | [STYLEGUIDE.md](STYLEGUIDE.md)     |
| 즉시 중단 조건  | [POLICY.md](POLICY.md)             |
| 승인 필요       | [GOVERNANCE.md](GOVERNANCE.md)     |
