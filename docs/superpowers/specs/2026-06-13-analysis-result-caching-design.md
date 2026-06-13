# 분석 결과 캐싱 — 설계

작성일: 2026-06-13

## 목적

같은 채널을 반복 분석할 때 YouTube Data API 쿼터를 절약한다. 1회 분석은
`search` ×5(각 100유닛) 등으로 ≈500유닛을 쓰므로(일 10,000), 캐시 히트 시
**API 호출 0번**으로 응답한다.

> 참고: MVP 설계(`2026-06-13-youtube-content-recommender-design.md`)에서 캐싱은
> "스코프 제외(YAGNI)"였다. 본 문서는 그 결정을 의도적으로 되돌린다.

## 결정 사항 (사용자 합의)

- **저장소**: 인메모리 `Map` (서버 프로세스 내, 의존성 0). 서버 재시작 시 초기화.
- **TTL**: 6시간. 바이럴 검색의 신선도와 쿼터 절약의 균형.
- **강제 새로고침**: 제외(YAGNI). TTL 만료로만 갱신.

## 아키텍처

기존 패턴 준수: 순수 로직은 네트워크 무관·단위 테스트(`lib/analysis.ts` 등),
모든 YouTube 호출은 서버 라우트에서만.

- **`lib/cache.ts`** (신규, 순수·테스트 대상) — 제네릭 TTL 캐시.
  - `now`(밀리초)를 인자로 주입받아 실제 타이머 없이 만료를 테스트 가능.
  - 인터페이스:
    - `createCache<T>(ttlMs: number)` → `{ get(key, now), set(key, value, now) }`
    - `get` → 저장 시각 + ttlMs > now 이면 값, 아니면(만료/없음) `undefined`
    - `set` → 값과 저장 시각(now) 기록
  - TTL 상수 `ANALYSIS_TTL_MS = 6 * 60 * 60 * 1000`.
- **`app/api/analyze/route.ts`** (얇은 배선 ~10줄) — 모듈 레벨 싱글톤 캐시 사용.
  - 키 = `parseChannelInput(channelUrl)` → `` `${ref.type}:${ref.value}` ``
    (이미 테스트된 정규화 재사용 → `/channel/UC…`·bare `UC…`·`@handle`·전체 URL의
    표기 변형을 동일 키로 흡수, 키 산출에 API 호출 없음)
  - 히트(6h 내): 저장된 `AnalysisResult` 반환 + `buildReport` 재계산
    (리포트는 저렴한 순수 함수 → 결과만 캐싱)
  - 미스: `analyzeChannel` 호출 → `cache.set` → 반환

## 데이터 흐름

```
POST channelUrl
  → key = `${ref.type}:${ref.value}`  (parseChannelInput)
  → cache.get(key, Date.now())
       ├─ 히트 → result(캐시) ─┐
       └─ 미스 → analyzeChannel → cache.set(key, result) ─┤
                                                          ▼
                              report = buildReport(result)
                              → { result, report }
```

## 에러 처리

성공 결과만 캐싱한다. 채널 못 찾음·키 누락·API 오류는 캐싱하지 않고 기존대로
전파 → 실패가 6시간 고착되지 않는다. (캐시는 `analyzeChannel` 성공 후에만 `set`.)

## 테스트 (TDD)

- `lib/cache.test.ts` 먼저 작성 → 통과시키는 구현:
  - set 후 즉시 get → 값 반환
  - TTL 만료 경계: `now = 저장시각 + ttl - 1` 히트, `+ ttl` 또는 그 이상 미스
  - 없는 키 → `undefined`
  - 키 격리(다른 키 간섭 없음)
  - 같은 키 재 set → 최신 값·시각으로 갱신
- 키 산출은 `parseChannelInput`(기존 테스트 보유) 재사용 → 별도 테스트 불필요.
- 라우트 배선은 얇아 기존 수동/E2E 검증으로 커버.

## 스코프 제외 (YAGNI)

강제 새로고침, 파일·DB 영속화, 캐시 크기 제한·LRU 축출, 분산/멀티 인스턴스 공유.
(단일 사용자가 소수 채널만 조회하는 프로토타입 → 무한 증가 위험 낮음.)

## 알아둘 점

- `analysis`는 `now`에 의존(최근성 점수·`publishedAfter` 30일 창). 캐시 결과는
  계산 시점의 `now`에 고정되지만 6h TTL 내에서는 허용 가능한 staleness.
- 인메모리라 `npm run dev`/서버 재시작 시 비워진다 — 의도된 단순함.
