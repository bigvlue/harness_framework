# 강제 새로고침(캐시 우회 재분석) — 설계

작성일: 2026-06-13

## 목적

분석 결과 캐싱(`2026-06-13-analysis-result-caching-design.md`) 도입 후, 사용자가
6시간 TTL을 기다리지 않고 **현재 채널을 지금 다시 분석**할 수 있게 한다. 캐시를
우회하고 새 결과로 캐시를 갱신한다.

## 결정 사항 (사용자 합의)

- **트리거**: 대시보드 하단 액션에 "♻ 강제 재분석" 버튼. 현재 분석된 채널을 대상으로 함.
- **로딩 UX**: 기존 분석 흐름 재사용(대시보드가 사라지고 "⏳ 분석 중…" 표시 후 재렌더).
- **캐시 모듈 변경 없음**: get 생략 + set 덮어쓰기로 충분. `delete`/전체 비우기는 범위 밖(YAGNI).

## 아키텍처

기존 패턴 유지: YouTube 호출은 서버 라우트에서만, 캐시는 서버 측.

### 서버 — `app/api/analyze/route.ts`

- 요청 body에서 선택적 `refresh: boolean`을 읽는다.
- `refresh === true`: `cache.get`을 건너뛰고 항상 `analyzeChannel`을 실행한 뒤
  `cache.set`으로 캐시를 덮어쓴다(이후 일반 요청은 갱신된 결과를 받음).
- `refresh`가 거짓/없음: 기존 동작(캐시 우선) 그대로.
- 400 검증, `try/catch`(에러 비캐싱·전파), `{ result, report }` 응답 형태 불변.

제어 흐름:

```
const wantFresh = refresh === true;
let result = wantFresh ? undefined : cache.get(key, now);
if (!result) {
  result = await analyzeChannel(channelUrl, new Date(now));
  cache.set(key, result, now);
}
```

### 클라이언트 — `app/page.tsx`

- `analyze(refresh = false)`로 파라미터화 → POST body에 `refresh` 포함.
- 기존 "분석" 버튼: `analyze()` 호출(기본 false) — 동작 변화 없음.
- 대시보드 하단 액션에 버튼 추가: **"♻ 강제 재분석"** → `onClick={() => analyze(true)}`.
  현재 `url` state(분석된 채널)를 그대로 사용하므로 같은 채널을 캐시 무시하고 재분석.
  `disabled`는 기존 버튼과 동일(`loading || url.trim() === ''`).

## 데이터 흐름

```
대시보드 "♻ 강제 재분석" 클릭
  → analyze(true)
  → POST { channelUrl, refresh: true }
  → 라우트: cache.get 생략 → analyzeChannel → cache.set(덮어쓰기)
  → { result, report } → 대시보드 재렌더
```

## 에러 처리

기존과 동일. `analyzeChannel` 실패 시 throw → catch → 500 + 메시지. 실패 결과는
`cache.set` 전에 throw되므로 캐싱되지 않는다(refresh 여부 무관).

## 테스트

새로 추가되는 것은 라우트의 조건 분기 1개와 UI 배선뿐 — 네트워크/UI 의존이라
순수 단위 테스트 대상이 아니다. 캐시 모듈(`lib/cache.ts`)은 이미 테스트됨.

- 기존 28개 테스트 그린 유지(`npm run test`).
- `npm run build` 타입 체크 통과.
- 수동 확인: 같은 채널 (a) 일반 재요청 → 캐시 히트(빠름, fetch 없음), (b) "♻ 강제
  재분석" → 실제 YouTube fetch 발생 + 캐시 갱신.

한 줄 조건문을 위한 인위적 테스트 추출은 하지 않는다(YAGNI).

## 스코프 제외 (YAGNI)

캐시 TTL 변경, 전체 캐시 비우기, 자동 새로고침 주기, 캐시 상태 UI 표시(별도 백로그).
