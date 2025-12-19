1. CLI Watcher의 정교화 (DX 보강)
   NestJS는 nest start --watch를 통해 코드를 고치면 즉시 반영됩니다. bunner는 CLI가 메타데이터를 생성해야 하므로 이 과정이 자동화되어야 합니다.

보강점: packages/cli에 Bun.watch를 활용한 증분 빌드(Incremental Build) 기능을 넣어야 합니다.

이유: 파일을 하나 수정할 때마다 전체 프로젝트를 다시 스캔하면 대규모 프로젝트에서 개발 경험이 나빠집니다. 수정된 파일만 파싱하여 manifest의 해당 부분만 업데이트하는 로직이 필요합니다.

2. JIT 생성 코드의 디버깅 편의성 (안정성 보강)
   new Function()으로 생성된 코드는 에러 발생 시 **스택 트레이스(Stack Trace)**를 읽기가 매우 어렵습니다.

보강점: 생성되는 함수 문자열 맨 뒤에 //# sourceURL=bunner://jit/UserController_transform 같은 가상 경로를 추가하세요.

이유: 이렇게 하면 브라우저나 IDE 디버거에서 런타임에 생성된 익명 함수도 마치 실제 소스 파일처럼 이름을 가지고 표시되어 디버깅이 가능해집니다.

3. 순환 참조(Circular Dependency)의 정적 탐지
   NestJS 개발자들이 가장 고생하는 부분 중 하나가 ForwardRef를 사용해야 하는 순환 참조 문제입니다.

보강점: 런타임에 에러를 내기보다, CLI 스캔 단계에서 순환 참조를 미리 탐지하여 빌드 타임 에러를 던져줘야 합니다.

이유: 리플렉션이 없는 구조이므로 런타임 의존성 주입 시 순서가 꼬이면 원인 파악이 어렵습니다. CLI 단계에서 의존성 그래프(Directed Graph)를 그려 사이클을 체크하는 로직이 필수입니다.

4. 복잡한 타입 및 제네릭 대응 (기술적 보강)
   단순한 string, number 외에 Promise<User>, Partial<CreateUserDto> 같은 복잡한 타입을 CLI가 어떻게 처리할지가 관건입니다.

보강점: oxc-parser로 파싱할 때 단순 타입 이름만 가져오는 게 아니라, 타입 인자(Type Arguments)까지 재귀적으로 분석하여 스냅샷에 담아야 합니다.

이유: 특히 class-transformer 역할을 대신할 때, 배열 내부의 타입을 모르면 JIT 함수가 올바른 변환 로직을 생성할 수 없습니다.

5. Bun 네이티브 최적화의 심화 (성능 보강)
   단순히 Bun 드라이버를 쓰는 것을 넘어, Bun의 저수준 최적화 기능을 더 적극적으로 활용할 여지가 있습니다.

보강점:

Zero-copy String handling: HTTP 본문을 읽을 때 Bun.ArrayBuffer를 활용해 데이터 복사를 최소화.

Pre-compiled SQL: Bun.sql 사용 시 자주 쓰이는 쿼리를 CLI 단계에서 미리 파악해 런타임에 최적화된 상태로 바인딩.
