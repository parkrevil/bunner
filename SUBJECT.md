# SUBJECT

- [ ] 실행 모델(미들웨어/가드/핸들러, 컨텍스트 전파 최소 형태) — 동시에 만질 파일: execution, adapter(파이프라인 접점), dto(검증 위치)
- [ ] 에러 모델(Failure/Panic, 필터 체인, 프로토콜 변환 경계) — 동시에 만질 파일: error-handling, adapter, logger(에러 로깅)
- [ ] HTTP 어댑터(라우팅/파라미터/미들웨어/필터/응답 변환 기준선) — 동시에 만질 파일: adapter, execution, dto, docs(문서 추출 규칙)
- [ ] 문서 생성(docs) 및 DevTools(개발자 워크플로우) — 동시에 만질 파일: docs, devtools, aot-ast(추출 근거 필요 시)
- [ ] 클러스터/프로세스 모델(워커/라이프사이클, metadata volatility) — 동시에 만질 파일: cluster, execution(라이프사이클), manifest(런타임 잔존 데이터)
- [ ] 통합(ORM 등) — 동시에 만질 파일: drizzle-orm, provider(통합 provider 규약)
- [ ] common/SPEC.md 정리(전역 용어/규범/교차참조 “정합성 패스”만) — 앞 주제에서 생긴 정의를 SSOT로 정렬
