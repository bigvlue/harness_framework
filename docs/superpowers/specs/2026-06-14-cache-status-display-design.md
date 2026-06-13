# 캐시 상태 가시화 — 설계

작성일: 2026-06-14

## 목적

분석 결과가 언제 만들어졌는지 대시보드에 보여준다. 캐시 도입 후 사용자가 보는 결과가
방금 분석한 것인지, 캐시된(예: 30분 전) 것인지 알 수 있게 한다. "🕒 N분 전 분석됨".

## 결정 사항 (사용자 합의)

- **표시 범위**: 단일 채널 대시보드(`app/page.tsx`)만. 비교 페이지는 범위 밖.
- **표시 내용**: 상대 시간만("방금 전 / N분 전 / N시간 전 / N일 전"). 명시적 "캐시됨" 뱃지는
  두지 않는다 — 상대 시간이 신선/캐시를 자연스럽게 전달한다.

## 핵심 아이디어

분석 시각 `analyzedAt`을 `AnalysisResult`에 실어 둔다. 캐시는 결과 객체를 통째로 보관하므로
**캐시 히트 시 원래 분석 시각이 그대로 유지**된다. 클라이언트는 `현재 - analyzedAt`으로 상대
시간을 계산한다. 캐시·라우트는 변경하지 않는다(analyzedAt이 result 안에 있어 자동 보관·전달).

## 아키텍처

기존 패턴 준수: 순수 로직은 `lib/`에서 단위 테스트, 시각 스탬프는 서버(`analyzeChannel`)에서 부여.

### 파일

- **`types/analysis.ts`** (수정): `AnalysisResult`에 `analyzedAt: string` 추가(ISO 8601,
  기존 `VideoStat.publishedAt`과 동일 컨벤션).
- **`lib/youtube.ts`** (수정): `analyzeChannel(input, now)`의 반환 객체에
  `analyzedAt: now.toISOString()` 추가(이미 받는 `now` 사용).
- **`lib/time.ts`** (신규, 순수·테스트 대상):
  - `formatRelativeTime(fromIso: string, now: Date): string`
  - 규칙: `diff = now - fromIso`. <60초 → "방금 전", <60분 → "N분 전", <24시간 → "N시간 전",
    그 외 → "N일 전". 음수(미래) → "방금 전".
- **`lib/time.test.ts`** (신규): 경계 테스트.
- **`lib/report.test.ts`** (수정): 픽스처 `sample`에 `analyzedAt` 1줄 추가(필수 필드 충족).
- **`app/page.tsx`** (수정): `@/lib/time`에서 `formatRelativeTime` import, 대시보드 제목
  아래에 캡션 추가.

`lib/cache.ts`·`app/api/analyze/route.ts`·`lib/report.ts`·`app/compare/page.tsx`는 변경 없음.

### 데이터 흐름

```
analyzeChannel(input, now)
  → 결과에 analyzedAt: now.toISOString() 스탬프
  → cache.set(key, result)  // analyzedAt 포함된 채로 보관
route POST → cache.get(히트: 원래 analyzedAt) | 신규 → result 그대로 반환
대시보드 → 🕒 {formatRelativeTime(result.analyzedAt, new Date())} 분석됨
```

### 표시 위치 / 마크업

제목 `📊 {channelTitle} — 콘텐츠 대시보드` 바로 아래 작은 캡션. 제목과 캡션을 한 `<div>`로
묶어 캡션이 제목 바로 밑에 붙도록 한다(부모 `space-y-5`의 큰 간격 방지).

```tsx
<div>
  <h2 className="text-[24px] font-bold text-label-normal">
    📊 {result.channelTitle} — 콘텐츠 대시보드
  </h2>
  <p className="mt-1 text-[13px] text-label-alt">
    🕒 {formatRelativeTime(result.analyzedAt, new Date())} 분석됨
  </p>
</div>
```

`app/page.tsx`는 `'use client'`이고 대시보드는 `result`가 있을 때만(클라이언트 fetch 후)
렌더되므로 SSR 하이드레이션 불일치가 없다.

## 에러 처리

해당 없음(표시 전용). `analyzedAt`은 항상 `analyzeChannel`이 부여하므로 누락 케이스 없음.

## 테스트 (TDD)

- `lib/time.test.ts` 먼저 작성 → 통과 구현:
  - <60초 → "방금 전" (예: 0초, 30초)
  - 60초 → "1분 전", 59분 → "59분 전"
  - 60분 → "1시간 전", 23시간 → "23시간 전"
  - 24시간 → "1일 전", 3일 → "3일 전"
  - 미래(now < from) → "방금 전"
- `app/page.tsx`·`lib/youtube.ts`는 UI/네트워크 의존 → `npm run build`(타입) + 수동 확인.
- `lib/report.test.ts` 픽스처 업데이트 후 기존 테스트 그린 유지.

## 스코프 제외 (YAGNI)

비교 페이지 표시, 실시간 틱 갱신(1분마다 자동 갱신), 명시적 "캐시됨" 뱃지, 절대시각 툴팁,
리포트(.md)에 분석 시각 포함.
