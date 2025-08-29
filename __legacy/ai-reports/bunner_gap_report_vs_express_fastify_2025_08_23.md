# Bunner — Detailed Framework Gap Report vs Express & Fastify

**작성일:** 2025-08-23

> 목적: Bunner(네가 만든 Bun 기반 웹 프레임워크)를 **강력한 운영용 프레임워크**로 발전시키기 위해 Express 5.x, Fastify 5.x와 비교하여 부족한 점을 식별하고 우선순위, 설계 제안, 구현 샘플, 테스트/CI 지침까지 포함한 실행 가능한 로드맵을 제공.

---

## 요약 (Executive Summary)
- **핵심 목표:** 가볍고 빠른 Bun 런타임 장점을 유지하면서도 운영·보안·확장성(플러그인/훅/관측성/검증)을 갖춘 프레임워크로 진화.
- **우선순위(시급):** 정적 파일 경로 보안, 전역 에러/404 핸들러, 바디 파서(특히 multipart), 미들웨어 훅/스코프, 타입 안전성 보강
- **중간 우선순위:** 로깅/관측성(OpenTelemetry), rate-limiter/기본 보안 헤더, ETag/Conditional GET, 라우트 그룹/플러그인 시스템
- **장기 우선순위:** 정교한 플러그인 API, 성능 벤치마크·튜닝, 자동 문서화/스웨거 호환성, 커뮤니티 에코시스템

---

## 목표 사용자와 요구사항
- **타깃:** 고성능 Node/Bun 환경에서 작동하는 HTTP API 서버 개발자(게임 백엔드, 실시간 API, B2B REST 서비스)
- **기능 요구:** 안정적 정적 파일 서빙, 다양한 본문 파싱, 인증/권한 구성, 스키마 기반 검증, 플러그인/모듈화, 운영 모니터링
- **비기능 요구:** 낮은 레이턴시, 작은 번들 크기, 손쉬운 개발자 경험, 배포/로깅/보안 관점에서 운영성이 좋아야 함

---

## 상세 격차 분석 & 설계 제안
아래는 각 영역별 문제점, 영향도, 구체적 설계 제안, 샘플 코드, 테스트 케이스, 우선순위를 포함한다.

### 1. 정적 파일 서빙(보안/성능/기능)
**문제점**
- 경로 정규화 누락(디렉터리 트래버설 가능성)
- 캐시 관련 헤더(ETag, Last-Modified), 조건부 요청(If-None-Match/If-Modified-Since) 미지원
- MIME 유형 탐지/Content-Type 헷갈림
- 범위 요청(Range) 및 대용량 스트림 최적화 미흡

**영향도:** 보안(중대), 운영(캐시 미활용으로 비용증가), 사용자 경험

**설계 제안**
- `secureJoin(base, rel)` 도입: `path.resolve` 후 base 경로 벗어나면 403
- ETag/Last-Modified 생성 및 Conditional GET 구현
- MIME detection: `mime` 맵(확장자 기반) 또는 Bun에서 제공하는 API 사용
- Range header 지원: 부분 응답(206) 처리
- 캐시 정책 설정 API: `static({ maxAge, immutable, etag: true })`

**샘플 (pseudo)**
```ts
function secureJoin(base: string, requestPath: string) {
  const resolvedBase = path.resolve(base) + path.sep;
  const resolved = path.resolve(resolvedBase, requestPath);
  if (!resolved.startsWith(resolvedBase)) throw new Error('FORBIDDEN');
  return resolved;
}

// ETag
const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs}"`;
if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });

res.headers.set('Content-Type', mime.lookup(file));
res.headers.set('ETag', etag);
```

**테스트 케이스**
- `GET /static/../../etc/passwd` → 403
- 동일 파일 여러 요청에 대해 304 반환되는지 테스트
- `Range`로 파일 일부 요청 시 206 응답

**우선순위:** 최고

---

### 2. 전역 에러/404 핸들링 및 에러 모델
**문제점**
- 라우트/미들웨어 예외 처리 일관성 부족
- 개발/프로덕션 환경 별 에러 출력 분리 없음

**설계 제안**
- `app.setErrorHandler(fn)` 및 `app.setNotFoundHandler(fn)` API
- 라우트 등록시 내부적으로 `try/catch` 래퍼 적용. Promise rejection 처리
- 에러 객체 표준화: `{ status?: number, code?: string, message: string, meta?: any }`
- `errorFormatter` 플러그인 포인트 (로그 저장/전송)

**샘플**
```ts
app.setErrorHandler((err, req, res) => {
  const status = err.status || 500;
  if (env === 'production') res.json({ message: 'Internal Server Error' }, { status });
  else res.json({ message: err.message, stack: err.stack }, { status });
});
```

**테스트 케이스**
- 라우트 내부 `throw new Error('x')` → 등록된 error handler로 처리
- 정의되지 않은 경로 → 404 handler 호출

**우선순위:** 최고

---

### 3. 본문 파서 확장 (JSON, urlencoded, multipart/form-data)
**문제점**
- multipart 및 urlencoded 지원이 약함. 파일 업로드/폼 제출 처리 복잡

**설계 제안**
- 내장 파서 모듈(플러그인): `json()`, `urlencoded()`, `multipart({ limits })`
- 파일 저장 전략: 메모리/임시파일/스트리밍 옵션
- `req.body` 타입 제네릭으로 라우트 스키마 연동

**샘플**
```ts
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.post('/upload', multipart({ dest: '/tmp' }), (req,res) => {
  // req.files, req.body
});
```

**테스트 케이스**
- 큰 파일 업로드(>10MB) 스트리밍 동작 확인
- boundary malformed 테스트

**우선순위:** 높음

---

### 4. 미들웨어 시스템 & 훅(프로그래밍 모델)
**문제점**
- 현재 전역 `use()`만 존재, 경로 기반 미들웨어나 훅(PreHandler, PreSerialization 등) 제한적

**설계 제안**
- 훅 단계: `onRequest -> preValidation -> preHandler -> handler -> onSend -> onResponse`
- `app.use(path, middleware)` 오버로드 지원
- Route groups & plugin registration API: `app.register(plugin, { prefix: '/api' })`
- 미들웨어/플러그인 lifecycle( init/close ) 이벤트 제공

**샘플**
```ts
app.addHook('onRequest', (req) => { req.ctx.start = Date.now(); });
app.addHook('onSend', (req, res) => { res.headers.set('X-Response-Time', Date.now() - req.ctx.start + 'ms'); });

app.group('/api', (router) => { router.use(auth()); router.get('/me', handler); });
```

**테스트 케이스**
- 훅 호출 순서 검증 및 예외 발생 시 rollback/에러 전파

**우선순위:** 높음

---

### 5. 라우터 그룹화 및 플러그인 아키텍처
**문제점**
- 모듈화, 플러그인 설치/옵션 전달, 라우트 격리 기능 취약

**설계 제안**
- `app.register(plugin, opts)` 표준화. 플러그인은 `plugin(app, opts)` 형태
- 플러그인 롤백/종료 훅 제공
- 라우트 네임스페이스 & 버전 관리(예: `/v1`, `/v2`) 기본 지원

**샘플**
```ts
function myPlugin(app, opts) {
  app.get('/plugin-endpoint', () => {});
  return { close: async () => { /* cleanup */ } }
}
app.register(myPlugin, { prefix: '/myp' });
```

**우선순위:** 중

---

### 6. Schema 기반 검증 & 자동 타입 유추
**문제점**
- 현재 스키마 검증 통합 부족. Fastify처럼 Ajv/TypeBox 수준의 런타임 검증 + 타입 유추 지원 필요

**설계 제안**
- 선택적 통합: Zod/TypeBox/Ajv 플러그인 제공
- 라우트 정의 제네릭: `app.get<{ Params: P; Query: Q; Body: B; Reply: R }>(path, opts, handler)`
- 빌드 시 스키마에서 타입 추출 지원 (zod-to-ts 등)

**샘플**
```ts
app.post('/user', { schema: { body: z.object({ name: z.string() }) } }, (req, res) => {
  // req.body 타입이 z.infer<typeof schema>
});
```

**테스트 케이스**
- 스키마 오류에 대해 400 반환 및 에러 메시지 포맷 검증

**우선순위:** 중

---

### 7. 로깅 & 관측성 (OpenTelemetry, 지표)
**문제점**
- 기본 로깅/trace/metrics 통합 없음

**설계 제안**
- 내장/옵션 플러그인: `requestLogger`, `otelTracer`, `metrics()`
- 요청마다 `requestId` 발급, 응답시간/상태코드/경로 기록
- Error -> Sentry/Honeycomb 통합 포인트

**샘플**
```ts
app.use(requestLogger());
app.register(otelTracer, { serviceName: 'bunner' });
```

**테스트 케이스**
- requestId 유일성, 응답시간 헤더 포함 여부

**우선순위:** 중

---

### 8. 보안(헤더/레이트리밋/CSP 등)
**문제점**
- 기본 보안 헤더 미제공, 레이트리밋 없음

**설계 제안**
- `helmetLite` 기본 제공
- 간단 레이트리미터: IP 기반 토큰 버킷, 경로/토큰별 rate limit 설정
- CORS 확장: 동적 origin 함수, preflight 캐싱

**샘플**
```ts
app.use(helmetLite());
app.register(rateLimit, { windowMs: 60000, max: 100 });
```

**우선순위:** 중

---

### 9. 응답 최적화(압축, 스트리밍, Range)
**문제점**
- 압축/Range/streaming 기본 미지원

**설계 제안**
- `compression()` 미들웨어 (Accept-Encoding 협상)
- `res.stream()` API로 ReadableStream/Bun.file 에 바로 응답
- Range 요청과 partial content 처리

**우선순위:** 중

---

### 10. 문서화, 배포, 패키징
**문제점**
- API 문서 템플릿 로딩이 상대 경로 의존 -> 배포 취약
- dist에 `package.json` 자동 생성 필요

**설계 제안**
- `import.meta.url` 기반 자원 로딩
- 빌드 스크립트에서 `dist/package.json` 생성, `exports`/`types` 설정
- `npm pack`/`file:` 로컬 의존성 설치 가이드 문서화

**우선순위:** 중

---

## 운영/성능 벤치마크 권장
- 벤치마크 툴: `autocannon`, `wrk`, `hey` (TCP 기반) + 메모리/GC 모니터링
- 샘플 시나리오: static file, JSON API(1KB), DB-응답-패턴(동시 1000 users)
- 목표: Express 대비 latency 20% 개선, throughput 동등 이상

---

## 마이그레이션 가이드 (Express/Fastify -> Bunner)
1. 라우트: `app.get('/x', handler)` 그대로 유지, 다만 `req/res` 인터페이스 확인
2. 미들웨어: Express 미들웨어 래퍼 제공 `wrapExpressMw(mw)` 제공
3. Error middleware: Express의 `err, req, res, next` 를 Bunner에서 호환 처리
4. Fastify의 schema/validation: Zod/Ajv 플러그인으로 대체

---

## 구체적 구현 로드맵 (분기별)
- **Sprint 1 (2주)**: 정적 파일 보안 + ETag + 404/Error handler + 기본 body parsers
- **Sprint 2 (2주)**: Hook 시스템(단계별) + 라우트 그룹/플러그인 API + multipart 지원 개선
- **Sprint 3 (3주)**: 로깅/trace/metrics 플러그인 + rate limiter + compression
- **Sprint 4 (3주)**: 문서/예제 강화 + 벤치마크 + 배포 프로세스 정비

---

## 테스트와 CI 권장
- **테스트 유형:** 단위(버튼), 통합(라우터/미들웨어), E2E(autocannon), 보안(디렉터리 트래버설, 대량 업로드)
- **CI:** GitHub Actions 예시
  - lint -> unit tests -> build -> emit d.ts -> package dist -> run smoke tests -> publish (manual)
- **코드 커버리지:** 80% 목표, 중요 로직(경로 보안/파서/에러 핸들러)에 대한 높은 커버리지

---

## API 계약/타입 관련 권고
- 라우트 제네릭 사용하여 `req.params`, `req.query`, `req.body`, `res` 타입 추론 강화
- `tsconfig.build.json` 분리: 타입만 추출 설정, `skipLibCheck` true 권장
- `package.json` `exports`에 `types` 명시

---

## 체크리스트 (우선순위별) — 실무용
**긴급(지금 당장)**
- [ ] static path secureJoin 구현
- [ ] global error handler + not found handler
- [ ] tsc로 d.ts 추출 및 dist/package.json 자동화
- [ ] json/urlencoded/multipart 기본 파서

**높음**
- [ ] hooks(onRequest, preHandler, onSend, onResponse)
- [ ] route groups / register(plugin)
- [ ] ETag/If-None-Match 처리

**중간**
- [ ] request logger + requestId
- [ ] compression middleware
- [ ] rate limiter basic

**낮음**
- [ ] OpenTelemetry integration
- [ ] advanced plugin lifecycle hooks
- [ ] official migrations & cookbook

---

## 부록: 참고 코드/유틸들
- secureJoin 구현(위)
- ETag/Conditional GET snippet(위)
- basic helmetLite, compression pseudocode

---

## 결론
Bunner는 경량성과 Bun 런타임의 강점을 이미 갖추고 있어서 좋은 출발점이다. 운영용 프레임워크로서 경쟁력을 갖추려면 **보안(정적 서빙), 에러/미들웨어 아키텍처, 타입/스키마 통합, 관측성**에 집중적으로 투자하면 빠르게 Express/Fastify의 장점을 흡수할 수 있다.

---

*원하면 이 파일을 `.md`로 내려주거나(내가 canvas에 저장해 둠), 각 체크리스트 항목별로 PR-ready한 패치(코드 + 테스트)들도 단계별로 만들어줄게.*

