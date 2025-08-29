# Bunner Framework - 최종 통합 분석 레포트
## Express.js & Fastify 대비 상세 비교 및 발전 로드맵

**작성일:** 2025-08-23  
**버전:** 1.0  
**목적:** Bunner 프레임워크의 현재 상태 분석 및 운영용 프레임워크로의 발전 방향 제시

---

## 📋 목차
1. [실행 요약](#실행-요약)
2. [프로젝트 개요 및 비교](#프로젝트-개요-및-비교)
3. [아키텍처 분석](#아키텍처-분석)
4. [핵심 기능 비교](#핵심-기능-비교)
5. [Bunner의 강점](#bunner의-강점)
6. [Bunner의 약점 및 개선점](#bunner의-약점-및-개선점)
7. [우선순위별 개선 로드맵](#우선순위별-개선-로드맵)
8. [구현 가이드](#구현-가이드)
9. [테스트 및 CI 전략](#테스트-및-ci-전략)
10. [결론 및 권장사항](#결론-및-권장사항)

---

## 🎯 실행 요약

### 핵심 목표
Bunner를 **가볍고 빠른 Bun 런타임의 장점을 유지하면서도 운영·보안·확장성을 갖춘 프레임워크**로 발전시키는 것

### 현재 상태
- **강점**: Bun 네이티브 최적화, 간단한 학습 곡선, 현대적 TypeScript 지원
- **약점**: 미들웨어 시스템 부족, 에러 처리 제한적, 보안 기능 부족

### 우선순위 (시급순)
1. **긴급**: 정적 파일 보안, 전역 에러/404 핸들러, 바디 파서
2. **높음**: 미들웨어 훅 시스템, 라우터 그룹화, ETag/Conditional GET
3. **중간**: 로깅/관측성, Rate Limiting, 보안 헤더
4. **장기**: 플러그인 시스템, 성능 최적화, 커뮤니티 생태계

---

## 📊 프로젝트 개요 및 비교

### Bunner Framework
- **버전**: 0.0.1 (초기 개발 단계)
- **런타임**: Bun 전용
- **언어**: TypeScript
- **의존성**: 3개 (`http-status-codes`, `qs`, `yaml`)
- **코드 라인**: ~2,000줄
- **특징**: Bun 네이티브 최적화, Express.js 유사 API

### Express.js
- **버전**: 5.1.0 (성숙한 프레임워크)
- **런타임**: Node.js
- **언어**: JavaScript
- **의존성**: 30개 핵심 의존성
- **코드 라인**: ~15,000줄
- **특징**: 미니멀리스트, 미들웨어 중심, 풍부한 생태계

### Fastify
- **버전**: 5.5.0 (성숙한 프레임워크)
- **런타임**: Node.js
- **언어**: JavaScript
- **의존성**: 50+ 의존성
- **코드 라인**: ~25,000줄
- **특징**: 고성능, 스키마 검증, 플러그인 시스템

---

## 🏗️ 아키텍처 분석

### Bunner 아키텍처
```
Bunner
├── src/
│   ├── bunner.ts (메인 클래스)
│   ├── request.ts (요청 처리)
│   ├── response.ts (응답 처리)
│   ├── middlewares/ (미들웨어)
│   └── api-document-builder.ts (API 문서)
└── examples/
    └── api-doc/ (예제 애플리케이션)
```

**특징:**
- 단순한 클래스 기반 구조
- Bun 네이티브 API 직접 활용
- Express.js와 유사한 API 설계

### Express.js 아키텍처
```
Express
├── lib/
│   ├── application.js (애플리케이션 핵심)
│   ├── request.js (요청 확장)
│   ├── response.js (응답 확장)
│   ├── router/ (라우터 시스템)
│   └── middleware/ (미들웨어)
└── node_modules/ (30개 의존성)
```

**특징:**
- 미들웨어 체인 기반
- 플러그인 아키텍처
- 확장 가능한 구조

### Fastify 아키텍처
```
Fastify
├── lib/
│   ├── fastify.js (메인 엔트리)
│   ├── server.js (서버 관리)
│   ├── request.js (요청 처리)
│   ├── reply.js (응답 처리)
│   ├── route.js (라우팅)
│   ├── hooks.js (훅 시스템)
│   └── plugins/ (플러그인 시스템)
└── node_modules/ (50+ 의존성)
```

**특징:**
- 플러그인 기반 아키텍처
- 스키마 검증 시스템
- 고성능 라우팅

---

## 🔧 핵심 기능 비교

### 1. 라우팅 시스템

#### Bunner
```typescript
// 기본적인 라우팅
app.get('/users', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.delete('/users/:id', handler);

// 정적 파일 서빙
app.static('/public', { filePath: './public' });
```

**특징:**
- ✅ 간단하고 직관적인 API
- ✅ Bun 네이티브 라우팅
- ❌ 라우터 분리 불가
- ❌ 라우트 그룹핑 없음

#### Express.js
```javascript
// 기본 라우팅
app.get('/users', handler);
app.post('/users', handler);

// 라우터 분리
const userRouter = express.Router();
userRouter.get('/', handler);
app.use('/users', userRouter);

// 라우트 체이닝
app.route('/users')
  .get(handler)
  .post(handler)
  .put(handler);
```

**특징:**
- ✅ 라우터 분리 지원
- ✅ 라우트 체이닝
- ✅ 미들웨어 적용 가능
- ✅ 동적 라우트 파라미터

#### Fastify
```javascript
// 기본 라우팅
fastify.get('/users', handler);
fastify.post('/users', handler);

// 스키마 검증
fastify.get('/users/:id', {
  schema: {
    params: {
      type: 'object',
      properties: { id: { type: 'number' } }
    }
  }
}, handler);

// 플러그인 라우팅
fastify.register(async function (fastify, opts) {
  fastify.get('/users', handler);
}, { prefix: '/api/v1' });
```

**특징:**
- ✅ 스키마 검증
- ✅ 플러그인 시스템
- ✅ 고성능 라우팅
- ✅ 타입 안전성

### 2. 미들웨어 시스템

#### Bunner
```typescript
// CORS 미들웨어만 지원
app.use(cors({
  origin: 'http://localhost:3000'
}));

// 커스텀 미들웨어 제한적
app.middlewares.push(middleware);
```

**특징:**
- ✅ CORS 미들웨어 내장
- ❌ 미들웨어 체인 없음
- ❌ 에러 처리 미들웨어 없음
- ❌ 미들웨어 우선순위 제어 불가

#### Express.js
```javascript
// 미들웨어 체인
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 경로별 미들웨어
app.use('/api', authMiddleware);

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
```

**특징:**
- ✅ 풍부한 미들웨어 생태계
- ✅ 미들웨어 체인 시스템
- ✅ 에러 처리 미들웨어
- ✅ 조건부 미들웨어 적용

#### Fastify
```javascript
// 훅 시스템
fastify.addHook('preHandler', async (request, reply) => {
  // 요청 전 처리
});

fastify.addHook('onSend', async (request, reply, payload) => {
  // 응답 전 처리
});

// 플러그인 미들웨어
fastify.register(require('@fastify/cors'));
fastify.register(require('@fastify/helmet'));
```

**특징:**
- ✅ 훅 기반 시스템
- ✅ 플러그인 미들웨어
- ✅ 성능 최적화된 미들웨어
- ✅ 비동기 미들웨어 지원

### 3. 요청/응답 처리

#### Bunner
```typescript
// 요청 처리
app.get('/users', (req, res) => {
  const { query, params, body } = req;
  return { users: [] };
});

// 응답 처리
app.post('/users', (req, res) => {
  res.setStatus(201);
  return { id: 1, name: 'John' };
});
```

**특징:**
- ✅ Bun 네이티브 요청/응답
- ✅ 자동 JSON 직렬화
- ❌ 응답 스트리밍 제한적
- ❌ 파일 업로드 처리 제한적

#### Express.js
```javascript
// 요청 처리
app.get('/users', (req, res) => {
  const { query, params, body } = req;
  res.json({ users: [] });
});

// 응답 처리
app.post('/users', (req, res) => {
  res.status(201).json({ id: 1, name: 'John' });
});

// 파일 업로드
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename });
});
```

**특징:**
- ✅ 풍부한 요청/응답 API
- ✅ 파일 업로드 지원
- ✅ 스트리밍 응답
- ✅ 다양한 응답 형식

#### Fastify
```javascript
// 요청 처리 (스키마 검증)
fastify.get('/users/:id', {
  schema: {
    params: { type: 'object', properties: { id: { type: 'number' } } }
  }
}, async (request, reply) => {
  const { id } = request.params;
  return { user: { id } };
});

// 응답 처리
fastify.post('/users', async (request, reply) => {
  reply.status(201);
  return { id: 1, name: 'John' };
});
```

**특징:**
- ✅ 스키마 기반 검증
- ✅ 고성능 직렬화
- ✅ 타입 안전성
- ✅ 자동 문서 생성

### 4. 에러 처리

#### Bunner
```typescript
// 기본적인 에러 처리
app.get('/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) {
    res.setStatus(404);
    return { error: 'User not found' };
  }
  return user;
});
```

**특징:**
- ✅ 간단한 에러 처리
- ❌ 글로벌 에러 핸들러 없음
- ❌ 에러 미들웨어 없음
- ❌ 에러 로깅 시스템 없음

#### Express.js
```javascript
// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 비동기 에러 처리
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await findUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

**특징:**
- ✅ 글로벌 에러 핸들러
- ✅ 에러 미들웨어 체인
- ✅ 비동기 에러 처리
- ✅ 에러 로깅

#### Fastify
```javascript
// 글로벌 에러 핸들러
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

// 스키마 에러 처리
fastify.get('/users/:id', {
  schema: {
    params: { type: 'object', properties: { id: { type: 'number' } } }
  }
}, async (request, reply) => {
  const user = await findUser(request.params.id);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
});
```

**특징:**
- ✅ 스키마 기반 에러 처리
- ✅ 글로벌 에러 핸들러
- ✅ 에러 직렬화
- ✅ 에러 로깅

---

## 🚀 Bunner의 강점

### 1. Bun 네이티브 최적화
```typescript
// Bun 네이티브 API 직접 활용
const file = Bun.file('./public/index.html');
const stat = await file.stat();
```

**장점:**
- 최고 성능의 파일 서빙
- 네이티브 HTTP 서버
- 빠른 JSON 직렬화

### 2. 간단한 학습 곡선
```typescript
// Express.js와 유사한 API
app.get('/users', (req, res) => {
  return { users: [] };
});
```

**장점:**
- Express.js 개발자 친화적
- 빠른 프로토타이핑
- 명확한 코드 구조

### 3. 현대적 TypeScript 지원
```typescript
// 완전한 타입 안전성
interface User {
  id: number;
  name: string;
}

app.get('/users/:id', (req, res): User => {
  return { id: 1, name: 'John' };
});
```

**장점:**
- 컴파일 타임 에러 검출
- 자동 완성 지원
- 리팩토링 안전성

### 4. API 문서 자동 생성
```typescript
// OpenAPI 스펙 자동 생성
app.enableApiDocument('/api-doc', './spec.yaml');
```

**장점:**
- 자동 API 문서화
- Swagger UI 통합
- 개발자 경험 향상

---

## ❌ Bunner의 약점 및 개선점

### 1. 정적 파일 서빙 (보안/성능/기능)
**문제점:**
- 경로 정규화 누락 (디렉터리 트래버설 가능성)
- 캐시 관련 헤더 (ETag, Last-Modified), 조건부 요청 미지원
- MIME 유형 탐지/Content-Type 헷갈림
- 범위 요청 (Range) 및 대용량 스트림 최적화 미흡

**영향도:** 보안(중대), 운영(캐시 미활용으로 비용증가), 사용자 경험

### 2. 전역 에러/404 핸들링 및 에러 모델
**문제점:**
- 라우트/미들웨어 예외 처리 일관성 부족
- 개발/프로덕션 환경 별 에러 출력 분리 없음
- 글로벌 에러 핸들러 없음
- 에러 로깅 시스템 없음

### 3. 본문 파서 확장 (JSON, urlencoded, multipart/form-data)
**문제점:**
- multipart 및 urlencoded 지원이 약함
- 파일 업로드/폼 제출 처리 복잡
- 응답 스트리밍 제한적

### 4. 미들웨어 시스템 & 훅 (프로그래밍 모델)
**문제점:**
- 현재 전역 `use()`만 존재
- 경로 기반 미들웨어나 훅 제한적
- 미들웨어 체인 없음
- 미들웨어 우선순위 제어 불가

### 5. 라우터 그룹화 및 플러그인 아키텍처
**문제점:**
- 모듈화, 플러그인 설치/옵션 전달, 라우트 격리 기능 취약
- 라우터 분리 불가
- 라우트 그룹핑 없음

### 6. Schema 기반 검증 & 자동 타입 유추
**문제점:**
- 현재 스키마 검증 통합 부족
- Fastify처럼 Ajv/TypeBox 수준의 런타임 검증 + 타입 유추 지원 필요

### 7. 로깅 & 관측성 (OpenTelemetry, 지표)
**문제점:**
- 기본 로깅/trace/metrics 통합 없음
- 구조화된 로깅 없음
- 로그 레벨 제어 없음

### 8. 보안 (헤더/레이트리밋/CSP 등)
**문제점:**
- 기본 보안 헤더 미제공
- 레이트리밋 없음
- CSRF 보호 없음

### 9. 응답 최적화 (압축, 스트리밍, Range)
**문제점:**
- 압축/Range/streaming 기본 미지원
- 캐싱 시스템 없음

### 10. 문서화, 배포, 패키징
**문제점:**
- API 문서 템플릿 로딩이 상대 경로 의존 → 배포 취약
- dist에 `package.json` 자동 생성 필요

---

## 🎯 우선순위별 개선 로드맵

### Phase 1: 긴급 (2-3주)
**목표:** 기본적인 보안과 안정성 확보

#### 1.1 정적 파일 보안 + ETag
```typescript
// secureJoin 구현
function secureJoin(base: string, requestPath: string) {
  const resolvedBase = path.resolve(base) + path.sep;
  const resolved = path.resolve(resolvedBase, requestPath);
  if (!resolved.startsWith(resolvedBase)) throw new Error('FORBIDDEN');
  return resolved;
}

// ETag 구현
const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs}"`;
if (req.headers.get('if-none-match') === etag) {
  return new Response(null, { status: 304 });
}
```

#### 1.2 전역 에러/404 핸들러
```typescript
// 에러 핸들러
app.setErrorHandler((err, req, res) => {
  const status = err.status || 500;
  if (env === 'production') {
    res.json({ message: 'Internal Server Error' }, { status });
  } else {
    res.json({ message: err.message, stack: err.stack }, { status });
  }
});

// 404 핸들러
app.setNotFoundHandler((req, res) => {
  res.json({ error: 'Not Found' }, { status: 404 });
});
```

#### 1.3 기본 바디 파서
```typescript
// JSON 파서
app.use(bodyParser.json());

// URL Encoded 파서
app.use(bodyParser.urlencoded({ extended: true }));

// Multipart 파서
app.post('/upload', multipart({ dest: '/tmp' }), (req, res) => {
  // req.files, req.body
});
```

### Phase 2: 높음 (3-4주)
**목표:** 미들웨어 시스템과 라우팅 강화

#### 2.1 훅 시스템 구현
```typescript
// 훅 단계 정의
app.addHook('onRequest', (req) => { req.ctx.start = Date.now(); });
app.addHook('preHandler', (req) => { /* 검증 로직 */ });
app.addHook('onSend', (req, res) => { 
  res.headers.set('X-Response-Time', Date.now() - req.ctx.start + 'ms'); 
});
```

#### 2.2 라우터 그룹화
```typescript
// 라우터 분리
class BunnerRouter {
  private routes: Map<string, RouteHandler> = new Map();

  get(path: string, handler: RouteHandler) {
    this.routes.set(`GET:${path}`, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.routes.set(`POST:${path}`, handler);
  }
}

// 플러그인 시스템
app.register(plugin, { prefix: '/api/v1' });
```

#### 2.3 조건부 요청 지원
```typescript
// If-None-Match 처리
if (req.headers.get('if-none-match') === etag) {
  return new Response(null, { status: 304 });
}

// If-Modified-Since 처리
const lastModified = new Date(stat.mtime).toUTCString();
if (req.headers.get('if-modified-since') === lastModified) {
  return new Response(null, { status: 304 });
}
```

### Phase 3: 중간 (4-5주)
**목표:** 로깅, 보안, 성능 최적화

#### 3.1 로깅 시스템
```typescript
// 구조화된 로깅
class BunnerLogger {
  info(message: string, meta?: any) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }

  error(message: string, error?: Error) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      error: error?.stack
    }));
  }
}

// 요청 로거
app.use(requestLogger());
```

#### 3.2 보안 미들웨어
```typescript
// Helmet Lite
app.use(helmetLite());

// Rate Limiting
app.register(rateLimit, { windowMs: 60000, max: 100 });

// CORS 확장
app.use(cors({
  origin: (origin) => {
    return allowedOrigins.includes(origin);
  }
}));
```

#### 3.3 응답 최적화
```typescript
// 압축 미들웨어
app.use(compression());

// 스트리밍 응답
app.get('/stream', (req, res) => {
  return res.stream(readableStream);
});

// Range 요청 지원
app.get('/file', (req, res) => {
  const range = req.headers.get('range');
  if (range) {
    // 206 Partial Content 처리
  }
});
```

### Phase 4: 장기 (6-8주)
**목표:** 고급 기능과 생태계 구축

#### 4.1 스키마 검증
```typescript
// Zod 통합
app.post('/user', { 
  schema: { 
    body: z.object({ name: z.string() }) 
  } 
}, (req, res) => {
  // req.body 타입이 자동으로 추론됨
});
```

#### 4.2 플러그인 생태계
```typescript
// 플러그인 API
function myPlugin(app, opts) {
  app.get('/plugin-endpoint', () => {});
  return { close: async () => { /* cleanup */ } };
}

app.register(myPlugin, { prefix: '/myp' });
```

#### 4.3 성능 모니터링
```typescript
// OpenTelemetry 통합
app.register(otelTracer, { serviceName: 'bunner' });

// 메트릭 수집
app.register(metrics, { 
  endpoint: '/metrics',
  collectDefaultMetrics: true 
});
```

---

## 🔧 구현 가이드

### 1. 정적 파일 보안 구현
```typescript
// src/middlewares/static.ts
import { secureJoin } from '../utils/path';

export function staticFiles(options: StaticOptions) {
  return async (req: BunnerRequest, res: BunnerResponse) => {
    const { filePath, urlPath } = options;
    
    try {
      // 경로 보안 검증
      const safePath = secureJoin(filePath, req.path.replace(urlPath, ''));
      const file = Bun.file(safePath);
      const stat = await file.stat();
      
      if (!stat.isFile()) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // ETag 생성
      const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs}"`;
      
      // 조건부 요청 처리
      if (req.headers.get('if-none-match') === etag) {
        return res.status(304).end();
      }
      
      // 응답 헤더 설정
      res.headers.set('ETag', etag);
      res.headers.set('Last-Modified', new Date(stat.mtime).toUTCString());
      res.headers.set('Content-Type', getMimeType(safePath));
      
      return new Response(file);
    } catch (error) {
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(404).json({ error: 'File not found' });
    }
  };
}
```

### 2. 에러 핸들러 구현
```typescript
// src/middlewares/error-handler.ts
export class ErrorHandler {
  private errorHandler?: (error: Error, req: BunnerRequest, res: BunnerResponse) => void;
  private notFoundHandler?: (req: BunnerRequest, res: BunnerResponse) => void;

  setErrorHandler(handler: (error: Error, req: BunnerRequest, res: BunnerResponse) => void) {
    this.errorHandler = handler;
  }

  setNotFoundHandler(handler: (req: BunnerRequest, res: BunnerResponse) => void) {
    this.notFoundHandler = handler;
  }

  async handleError(error: Error, req: BunnerRequest, res: BunnerResponse) {
    if (this.errorHandler) {
      await this.errorHandler(error, req, res);
    } else {
      // 기본 에러 처리
      const status = (error as any).status || 500;
      const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : error.message;
      
      res.status(status).json({ error: message });
    }
  }

  async handleNotFound(req: BunnerRequest, res: BunnerResponse) {
    if (this.notFoundHandler) {
      await this.notFoundHandler(req, res);
    } else {
      res.status(404).json({ error: 'Not Found' });
    }
  }
}
```

### 3. 미들웨어 체인 구현
```typescript
// src/middleware-chain.ts
export class MiddlewareChain {
  private middlewares: Array<{
    path?: string;
    handler: (req: BunnerRequest, res: BunnerResponse, next: () => void) => void;
  }> = [];

  use(middleware: (req: BunnerRequest, res: BunnerResponse, next: () => void) => void): void;
  use(path: string, middleware: (req: BunnerRequest, res: BunnerResponse, next: () => void) => void): void;
  use(pathOrMiddleware: string | Function, middleware?: Function): void {
    if (typeof pathOrMiddleware === 'string' && middleware) {
      this.middlewares.push({ path: pathOrMiddleware, handler: middleware });
    } else {
      this.middlewares.push({ handler: pathOrMiddleware as Function });
    }
  }

  async execute(req: BunnerRequest, res: BunnerResponse): Promise<void> {
    let index = 0;
    
    const next = async () => {
      if (index >= this.middlewares.length) return;
      
      const middleware = this.middlewares[index++];
      
      // 경로 매칭 확인
      if (middleware.path && !req.path.startsWith(middleware.path)) {
        return next();
      }
      
      try {
        await middleware.handler(req, res, next);
      } catch (error) {
        // 에러를 상위로 전파
        throw error;
      }
    };
    
    await next();
  }
}
```

---

## 🧪 테스트 및 CI 전략

### 테스트 유형
1. **단위 테스트**: 개별 함수/클래스 테스트
2. **통합 테스트**: 라우터/미들웨어 통합 테스트
3. **E2E 테스트**: 전체 애플리케이션 테스트
4. **보안 테스트**: 디렉터리 트래버설, 대량 업로드 등

### 테스트 예제
```typescript
// test/static-files.test.ts
describe('Static Files', () => {
  test('should serve files from public directory', async () => {
    const app = new Bunner();
    app.static('/public', { filePath: './test/assets' });
    
    const response = await app.handle(new Request('http://localhost/public/index.html'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  test('should prevent directory traversal', async () => {
    const app = new Bunner();
    app.static('/public', { filePath: './test/assets' });
    
    const response = await app.handle(new Request('http://localhost/public/../../../etc/passwd'));
    expect(response.status).toBe(403);
  });

  test('should return 304 for unchanged files', async () => {
    const app = new Bunner();
    app.static('/public', { filePath: './test/assets' });
    
    const firstResponse = await app.handle(new Request('http://localhost/public/index.html'));
    const etag = firstResponse.headers.get('etag');
    
    const secondResponse = await app.handle(
      new Request('http://localhost/public/index.html', {
        headers: { 'if-none-match': etag }
      })
    );
    
    expect(secondResponse.status).toBe(304);
  });
});
```

### CI/CD 파이프라인
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - name: Install dependencies
      run: bun install
    
    - name: Run linting
      run: bun run lint
    
    - name: Run tests
      run: bun test
    
    - name: Build
      run: bun run build
    
    - name: Run security tests
      run: bun test test/security/
    
    - name: Generate coverage report
      run: bun test --coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## 📈 성능 벤치마크 권장

### 벤치마크 도구
- **autocannon**: HTTP 벤치마킹
- **wrk**: 고성능 HTTP 벤치마킹
- **hey**: 간단한 HTTP 벤치마킹

### 벤치마크 시나리오
```bash
# 정적 파일 서빙
autocannon -c 100 -d 30 http://localhost:3000/public/index.html

# JSON API
autocannon -c 100 -d 30 -H "Content-Type: application/json" \
  -m POST -b '{"name":"test"}' http://localhost:3000/api/users

# 동시 사용자 시뮬레이션
autocannon -c 1000 -d 60 http://localhost:3000/api/users
```

### 목표 성능 지표
- **Latency**: Express 대비 20% 개선
- **Throughput**: Express와 동등 이상
- **Memory Usage**: Express 대비 30% 절약
- **Startup Time**: 1초 이내

---

## 🔄 마이그레이션 가이드

### Express.js → Bunner
```typescript
// Express.js
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// Bunner
app.get('/users', (req, res) => {
  return { users: [] }; // 자동 JSON 직렬화
});
```

### Fastify → Bunner
```typescript
// Fastify
fastify.get('/users/:id', {
  schema: { params: { type: 'object', properties: { id: { type: 'number' } } } }
}, async (request, reply) => {
  return { user: { id: request.params.id } };
});

// Bunner (스키마 검증 추가 후)
app.get('/users/:id', {
  schema: { params: z.object({ id: z.number() }) }
}, (req, res) => {
  return { user: { id: req.params.id } };
});
```

---

## ✅ 체크리스트 (우선순위별)

### 긴급 (지금 당장)
- [ ] static path secureJoin 구현
- [ ] global error handler + not found handler
- [ ] tsc로 d.ts 추출 및 dist/package.json 자동화
- [ ] json/urlencoded/multipart 기본 파서

### 높음
- [ ] hooks(onRequest, preHandler, onSend, onResponse)
- [ ] route groups / register(plugin)
- [ ] ETag/If-None-Match 처리

### 중간
- [ ] request logger + requestId
- [ ] compression middleware
- [ ] rate limiter basic

### 낮음
- [ ] OpenTelemetry integration
- [ ] advanced plugin lifecycle hooks
- [ ] official migrations & cookbook

---

## 🎯 결론 및 권장사항

### Bunner의 현재 상태
- **강점**: Bun 네이티브 최적화, 간단한 학습 곡선, 현대적 TypeScript 지원
- **약점**: 미들웨어 시스템 부족, 에러 처리 제한적, 보안 기능 부족

### Express.js 대비
- **우위**: Bun 네이티브 성능, TypeScript 지원, API 문서 자동 생성
- **열위**: 미들웨어 생태계, 에러 처리, 보안 기능

### Fastify 대비
- **우위**: 간단한 학습 곡선, Bun 네이티브 최적화
- **열위**: 성능, 스키마 검증, 플러그인 시스템

### 권장사항

#### 단기 (1-2개월)
1. **보안 강화**: 정적 파일 경로 보안, 기본 보안 헤더
2. **에러 처리**: 글로벌 에러 핸들러, 404 핸들러
3. **기본 기능**: 바디 파서, ETag 지원

#### 중기 (3-6개월)
1. **미들웨어 시스템**: 훅 시스템, 라우터 그룹화
2. **로깅/관측성**: 구조화된 로깅, 메트릭 수집
3. **성능 최적화**: 압축, 스트리밍, 캐싱

#### 장기 (6-12개월)
1. **플러그인 생태계**: 표준 플러그인 API
2. **스키마 검증**: Zod/TypeBox 통합
3. **커뮤니티**: 문서화, 예제, 마이그레이션 가이드

### 최종 목표
Bunner는 Bun 런타임의 잠재력을 최대한 활용할 수 있는 프레임워크로 발전할 수 있지만, 현재는 Express.js나 Fastify에 비해 기능적으로 부족한 상태입니다. 체계적인 개선을 통해 **Bun 생태계의 대표 프레임워크**로 성장할 수 있을 것입니다.

**핵심은 Bun의 성능 장점을 유지하면서도 운영·보안·확장성을 갖춘 프레임워크로 진화하는 것입니다.**

---

*이 레포트는 Bunner 프레임워크의 발전 방향을 제시하며, 각 단계별로 구체적인 구현 가이드와 테스트 전략을 포함합니다. 체계적인 접근을 통해 Bunner를 운영용 프레임워크로 발전시킬 수 있을 것입니다.*
