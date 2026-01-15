# ROADMAP

## Manifest 최적화

- 개발 환경:
  - 가독성과 진단을 위해 string 기반 표현을 유지한다.

- 운영 환경(런타임 메모리 우선):
  - 실행 경로에 string을 상주시키지 않는다.
  - 빌드 타임에 number/bit 기반으로 컴파일된 실행 테이블(인덱스/마스크)을 사용한다.
  - 사람이 읽는 label(string)은 실행 테이블과 분리된 별도 산출물로 다룬다.

- string vs number vs bit 고려
  - string
    - 장점: 가독성, 진단, 관측 출력
    - 단점: 산출물 크기 및 로딩(파싱) 피크 비용 증가
  - number
    - 장점: 인덱스 기반 접근, 산출물/피크 비용 절감에 유리
    - 단점: label이 필요하면 역매핑이 필요
  - bit
    - 장점: 플래그/집합 연산에 유리
    - 단점: label을 위한 역매핑 및 디코딩이 필요

- 운영 모니터링/DevTools(런타임 string 배제 전략)
  - 런타임 내부 식별자는 code(number/bit)로만 유지한다.
  - 관측 출력(로그/트레이스/대시보드)에서는 code를 label로 변환한다.
    - 옵션 A: 외부(사이드카/에이전트/중앙 서비스)에 매핑 테이블을 두고 변환한다.
    - 옵션 B: 필요 시에만 매핑 테이블을 로드하고 최소 캐시한다.

## FFI

FFI 통합 — 동시에 만질 파일: `docs/30_SPEC/ffi.spec.md`, `docs/30_SPEC/provider.spec.md`
