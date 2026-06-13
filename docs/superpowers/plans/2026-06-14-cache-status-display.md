# 캐시 상태 가시화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 결과에 분석 시각을 실어, 대시보드에 "🕒 N분 전 분석됨"으로 캐시 신선도를 보여준다.

**Architecture:** `AnalysisResult`에 `analyzedAt`(ISO)을 추가하고 `analyzeChannel`이 스탬프한다. 캐시가 결과를 통째로 보관하므로 히트 시 원래 시각이 유지된다(캐시·라우트 무변경). 상대 시간 포맷은 순수 함수 `lib/time.ts`(TDD)로 분리하고 대시보드가 표시한다.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Vitest 2.

설계 근거: `docs/superpowers/specs/2026-06-14-cache-status-display-design.md`

---

## File Structure

- **Create** `lib/time.ts` — `formatRelativeTime(fromIso, now)`. 순수.
- **Create** `lib/time.test.ts` — 경계 테스트.
- **Modify** `types/analysis.ts` — `AnalysisResult.analyzedAt: string` 추가.
- **Modify** `lib/youtube.ts` — `analyzeChannel` 반환에 `analyzedAt: now.toISOString()`.
- **Modify** `lib/report.test.ts` — 픽스처에 `analyzedAt` 추가(필수 필드 충족).
- **Modify** `app/page.tsx` — `formatRelativeTime` import + 제목 아래 캡션.

`lib/cache.ts`·`app/api/analyze/route.ts`·`lib/report.ts`·`app/compare/page.tsx`는 변경 없음.

## 사전 준비 (브랜치)

현재 `main`. 구현 커밋 전에 기능 브랜치를 만든다.

```bash
git checkout -b feat/cache-status-display
```

---

### Task 1: 상대 시간 포맷 순수 함수 (`lib/time.ts`)

**Files:**
- Create: `lib/time.ts`
- Test: `lib/time.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time';

// 기준 시각 고정: 2026-06-14T12:00:00Z
const now = new Date('2026-06-14T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('formatRelativeTime', () => {
  it('60초 미만은 "방금 전"', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('방금 전');
    expect(formatRelativeTime(ago(30_000), now)).toBe('방금 전');
    expect(formatRelativeTime(ago(59_000), now)).toBe('방금 전');
  });

  it('분 단위', () => {
    expect(formatRelativeTime(ago(60_000), now)).toBe('1분 전');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5분 전');
    expect(formatRelativeTime(ago(59 * 60_000), now)).toBe('59분 전');
  });

  it('시간 단위', () => {
    expect(formatRelativeTime(ago(60 * 60_000), now)).toBe('1시간 전');
    expect(formatRelativeTime(ago(23 * 60 * 60_000), now)).toBe('23시간 전');
  });

  it('일 단위', () => {
    expect(formatRelativeTime(ago(24 * 60 * 60_000), now)).toBe('1일 전');
    expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000), now)).toBe('3일 전');
  });

  it('미래 시각은 "방금 전"', () => {
    expect(formatRelativeTime(ago(-10_000), now)).toBe('방금 전');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/time.test.ts`
Expected: FAIL — `Failed to resolve import "./time"`.

- [ ] **Step 3: 최소 구현**

Create `lib/time.ts`:

```ts
/**
 * ISO 시각과 기준 시각(now)의 차이를 한국어 상대 시간으로 포맷한다.
 * 음수(미래) 차이는 "방금 전"으로 처리한다.
 */
export function formatRelativeTime(fromIso: string, now: Date): string {
  const sec = Math.floor((now.getTime() - new Date(fromIso).getTime()) / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/time.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/time.ts lib/time.test.ts
git commit -m "feat: add relative time formatter"
```

---

### Task 2: AnalysisResult에 analyzedAt 추가 + 스탬프 (`types/analysis.ts`, `lib/youtube.ts`, `lib/report.test.ts`)

**Files:**
- Modify: `types/analysis.ts`
- Modify: `lib/youtube.ts`
- Modify: `lib/report.test.ts`

타입에 필수 필드를 추가하므로, 생성처(`youtube.ts`)와 테스트 픽스처(`report.test.ts`)를 함께 맞춰 빌드·테스트를 그린으로 유지한다.

- [ ] **Step 1: 타입에 필드 추가**

`types/analysis.ts`의 `AnalysisResult` 인터페이스에 필드를 추가한다.

```ts
export interface AnalysisResult {
  channelTitle: string;
  channelStats: ChannelStats;
  channelKeywords: string[];
  channelBest: VideoStat[];
  viralVideos: VideoStat[];
  recommendations: Recommendation[];
}
```
→
```ts
export interface AnalysisResult {
  channelTitle: string;
  channelStats: ChannelStats;
  channelKeywords: string[];
  channelBest: VideoStat[];
  viralVideos: VideoStat[];
  recommendations: Recommendation[];
  analyzedAt: string; // 분석 수행 시각 (ISO 8601). 캐시 히트 시 원래 분석 시각 유지.
}
```

- [ ] **Step 2: analyzeChannel이 스탬프**

`lib/youtube.ts`의 `analyzeChannel` 반환 객체에 `analyzedAt`을 추가한다. 현재 반환:

```ts
  return {
    channelTitle: channel.title,
    channelStats: {
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
      avgRecentViews,
    },
    channelKeywords: keywords,
    channelBest,
    viralVideos,
    recommendations,
  };
```
→
```ts
  return {
    channelTitle: channel.title,
    channelStats: {
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
      avgRecentViews,
    },
    channelKeywords: keywords,
    channelBest,
    viralVideos,
    recommendations,
    analyzedAt: now.toISOString(),
  };
```

- [ ] **Step 3: report 테스트 픽스처 업데이트**

`lib/report.test.ts`의 `sample` 객체에 `analyzedAt`을 추가한다. `recommendations: [...]` 배열 닫는 줄 다음, 객체 닫는 `};` 앞에 추가:

```ts
  recommendations: [
    { topic: '"매운" 주제 콘텐츠', rationale: '바이럴 영상 「매운 먹방」', fit: '확장 기회', expansion: true },
  ],
};
```
→
```ts
  recommendations: [
    { topic: '"매운" 주제 콘텐츠', rationale: '바이럴 영상 「매운 먹방」', fit: '확장 기회', expansion: true },
  ],
  analyzedAt: '2026-06-14T12:00:00Z',
};
```

- [ ] **Step 4: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공(타입 에러 없음).

Run: `npm run test`
Expected: PASS — 기존 34 + time 5 = 39개.

- [ ] **Step 5: 커밋**

```bash
git add types/analysis.ts lib/youtube.ts lib/report.test.ts
git commit -m "feat: stamp analyzedAt on analysis results"
```

---

### Task 3: 대시보드에 분석 시각 캡션 추가 (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: formatRelativeTime import 추가**

`app/page.tsx`의 기존 analysis import 줄:

```tsx
import { formatKoreanCount } from '@/lib/analysis';
```
바로 아래에 추가:
```tsx
import { formatRelativeTime } from '@/lib/time';
```

- [ ] **Step 2: 제목 아래 캡션 추가**

대시보드 제목 블록을 제목+캡션 묶음으로 교체한다. 현재:

```tsx
          <h2 className="text-[24px] font-bold text-label-normal">
            📊 {result.channelTitle} — 콘텐츠 대시보드
          </h2>
```
→
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

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공 — `page.tsx` 컴파일, `result.analyzedAt` 타입 OK.

Run: `npm run test`
Expected: PASS — 39개.

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: show relative analysis time on dashboard"
```

---

### Task 4: 최종 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트 + 빌드 재확인**

Run: `npm run test && npm run build`
Expected: 39개 PASS, 빌드 성공.

- [ ] **Step 2 (선택): 수동 동작 확인**

`.env`에 `YOUTUBE_API_KEY`가 있는 상태에서 `npm run dev`:
1. 채널 분석 → 제목 아래 "🕒 방금 전 분석됨" 표시.
2. "다른 채널 분석"으로 같은 채널 재분석(캐시 히트) → 시간이 지났으면 "🕒 N분 전 분석됨"(원래 분석 시각 기준).
3. "♻ 강제 재분석" → 다시 "🕒 방금 전 분석됨"으로 갱신.

- [ ] **Step 3: PR 준비 (사용자 요청 시)**

`feat/cache-status-display` → PR 생성. (커밋·푸시·PR은 사용자 확인 후 진행.)

---

## Self-Review

**Spec coverage:**
- analyzedAt을 AnalysisResult에 추가 → Task 2 Step 1 ✓
- analyzeChannel 스탬프 → Task 2 Step 2 ✓
- 캐시·라우트 무변경(자동 보관) → 어떤 태스크도 cache.ts/route.ts 미수정 ✓
- formatRelativeTime 순수 함수 + 규칙(방금/분/시간/일, 미래) → Task 1 ✓
- 대시보드만 표시, 제목 아래 캡션 → Task 3 ✓
- report 픽스처 동기화 → Task 2 Step 3 ✓
- 상대 시간만(캐시 뱃지 없음) → 캡션 문구 "N분 전 분석됨"만 ✓

**Placeholder scan:** 모든 step에 실제 코드/명령/기대출력. 플레이스홀더 없음 ✓

**Type consistency:** `analyzedAt: string`(Task 2) ↔ `formatRelativeTime(fromIso: string, now: Date)`(Task 1) ↔ Task 3에서 `formatRelativeTime(result.analyzedAt, new Date())` 호출 — 타입 일치 ✓. `now.toISOString()`은 string 반환 ✓. report 픽스처 `analyzedAt: string` ✓. `formatRelativeTime`는 `@/lib/time` export, Task 3에서 동일 경로 import ✓.
