# 다중 채널 비교 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 YouTube 채널의 KPI와 주요 주제(공통/차이)를 `/compare` 페이지에서 나란히 비교한다.

**Architecture:** 키워드 비교는 순수 함수 `lib/compare.ts`(TDD)로 분리한다. `/compare` 클라이언트 페이지는 기존 `/api/analyze`를 채널당 1회씩 병렬 호출(캐시·서버 로직 재사용, 서버 변경 0)해 두 `AnalysisResult`를 받아 KPI 표 + 주제 3그룹으로 렌더한다.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Vitest 2, Tailwind CSS 3.

설계 근거: `docs/superpowers/specs/2026-06-13-multi-channel-compare-design.md`

---

## File Structure

- **Create** `lib/compare.ts` — `compareKeywords(a, b)` → `{ common, onlyA, onlyB }`. 순수, 집합 연산, 순서 보존.
- **Create** `lib/compare.test.ts` — compareKeywords 단위 테스트.
- **Create** `app/compare/page.tsx` — 비교 페이지(클라이언트). 입력 2개 → `/api/analyze` 병렬 호출 → 비교 뷰.
- **Modify** `app/page.tsx` — 헤더에 "여러 채널 비교 →" 링크 추가(import + 헤더 블록).

기존 `lib/youtube.ts`·`app/api/analyze/route.ts`·타입은 변경 없음.

## 사전 준비 (브랜치)

현재 `main`. 구현 커밋 전에 기능 브랜치를 만든다.

```bash
git checkout -b feat/multi-channel-compare
```

---

### Task 1: 키워드 비교 순수 함수 (`lib/compare.ts`)

**Files:**
- Create: `lib/compare.ts`
- Test: `lib/compare.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/compare.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compareKeywords } from './compare';

describe('compareKeywords', () => {
  it('공통/onlyA/onlyB로 분류한다', () => {
    expect(compareKeywords(['vlog', 'cafe', 'travel'], ['cafe', 'travel', 'cooking'])).toEqual({
      common: ['cafe', 'travel'],
      onlyA: ['vlog'],
      onlyB: ['cooking'],
    });
  });

  it('교집합이 없으면 common은 빈 배열', () => {
    expect(compareKeywords(['a', 'b'], ['c', 'd'])).toEqual({
      common: [],
      onlyA: ['a', 'b'],
      onlyB: ['c', 'd'],
    });
  });

  it('완전히 같으면 onlyA·onlyB는 빈 배열', () => {
    expect(compareKeywords(['a', 'b'], ['a', 'b'])).toEqual({
      common: ['a', 'b'],
      onlyA: [],
      onlyB: [],
    });
  });

  it('한쪽이 빈 배열', () => {
    expect(compareKeywords([], ['a', 'b'])).toEqual({ common: [], onlyA: [], onlyB: ['a', 'b'] });
    expect(compareKeywords(['a', 'b'], [])).toEqual({ common: [], onlyA: ['a', 'b'], onlyB: [] });
  });

  it('순서 보존: common·onlyA는 a 순서, onlyB는 b 순서', () => {
    const r = compareKeywords(['z', 'm', 'a'], ['a', 'z', 'q']);
    expect(r.common).toEqual(['z', 'a']); // a의 순서 유지
    expect(r.onlyA).toEqual(['m']);
    expect(r.onlyB).toEqual(['q']); // b의 순서 유지
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/compare.test.ts`
Expected: FAIL — `Failed to resolve import "./compare"`.

- [ ] **Step 3: 최소 구현**

Create `lib/compare.ts`:

```ts
export interface KeywordComparison {
  common: string[]; // a·b 모두에 있는 키워드 (a의 순서)
  onlyA: string[]; // a에만 있는 키워드 (a의 순서)
  onlyB: string[]; // b에만 있는 키워드 (b의 순서)
}

/**
 * 두 채널의 키워드 목록을 공통/각자 전용으로 분류한다.
 * 키워드는 이미 소문자·중복 제거된 top-N(topKeywords 결과)이라 정확 문자열 매칭으로 비교한다.
 */
export function compareKeywords(a: string[], b: string[]): KeywordComparison {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    common: a.filter((k) => setB.has(k)),
    onlyA: a.filter((k) => !setB.has(k)),
    onlyB: b.filter((k) => !setA.has(k)),
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/compare.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/compare.ts lib/compare.test.ts
git commit -m "feat: add keyword comparison helper"
```

---

### Task 2: 비교 페이지 + 홈 링크 (`app/compare/page.tsx`, `app/page.tsx`)

**Files:**
- Create: `app/compare/page.tsx`
- Modify: `app/page.tsx`

UI/네트워크 의존이라 단위 테스트 대상 아님. `npm run build`(타입) + `npm run test`(기존 28 + compare 5 = 33 그린)로 검증.

- [ ] **Step 1: 비교 페이지 생성**

Create `app/compare/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalysisResult } from '@/types/analysis';
import { formatKoreanCount } from '@/lib/analysis';
import { compareKeywords } from '@/lib/compare';

async function fetchAnalyze(channelUrl: string): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '분석에 실패했습니다.');
  return data.result;
}

function KpiRow({
  label,
  a,
  b,
  raw,
}: {
  label: string;
  a: string;
  b: string;
  raw: [number, number];
}) {
  const aWins = raw[0] > raw[1];
  const bWins = raw[1] > raw[0];
  return (
    <tr className="border-b border-line-normal">
      <td className="py-2 pr-4 text-[15px] text-label-alt">{label}</td>
      <td className={`py-2 text-right text-[16px] ${aWins ? 'font-bold text-primary' : 'text-label-normal'}`}>
        {a}
      </td>
      <td className={`py-2 text-right text-[16px] ${bWins ? 'font-bold text-primary' : 'text-label-normal'}`}>
        {b}
      </td>
    </tr>
  );
}

function KeywordChips({ words }: { words: string[] }) {
  if (words.length === 0) return <span className="text-[15px] text-label-alt">없음</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {words.map((k) => (
        <a
          key={k}
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(k)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-frame bg-fill-normal px-3 py-1 text-[15px] text-label-neutral hover:text-primary"
        >
          {k}
        </a>
      ))}
    </div>
  );
}

export default function Compare() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pair, setPair] = useState<{ a: AnalysisResult; b: AnalysisResult } | null>(null);

  async function compare() {
    setLoading(true);
    setError('');
    setPair(null);
    const [ra, rb] = await Promise.allSettled([fetchAnalyze(urlA), fetchAnalyze(urlB)]);
    if (ra.status === 'rejected' || rb.status === 'rejected') {
      const parts: string[] = [];
      if (ra.status === 'rejected')
        parts.push(`채널 A(${urlA}): ${ra.reason instanceof Error ? ra.reason.message : '실패'}`);
      if (rb.status === 'rejected')
        parts.push(`채널 B(${urlB}): ${rb.reason instanceof Error ? rb.reason.message : '실패'}`);
      setError(parts.join(' / '));
      setLoading(false);
      return;
    }
    setPair({ a: ra.value, b: rb.value });
    setLoading(false);
  }

  const kw = pair ? compareKeywords(pair.a.channelKeywords, pair.b.channelKeywords) : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-label-normal">⚖️ 채널 비교</h1>
        <Link href="/" className="text-[15px] text-primary hover:underline">
          ← 단일 채널 분석
        </Link>
      </div>

      <div className="space-y-3">
        <input
          className="w-full rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={urlA}
          onChange={(e) => setUrlA(e.target.value)}
          aria-label="채널 A URL"
          placeholder="채널 A URL"
        />
        <input
          className="w-full rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={urlB}
          onChange={(e) => setUrlB(e.target.value)}
          aria-label="채널 B URL"
          placeholder="채널 B URL"
        />
        <button
          className="rounded-frame bg-primary px-6 py-3 text-[16px] font-medium text-white hover:bg-primary-strong active:bg-primary-heavy disabled:opacity-50"
          onClick={compare}
          disabled={loading || urlA.trim() === '' || urlB.trim() === ''}
        >
          {loading ? '비교 중…' : '비교'}
        </button>
      </div>

      {!pair && !error && !loading && (
        <p className="mt-6 text-[15px] text-label-alt">두 채널 주소를 넣고 비교를 눌러보세요.</p>
      )}
      {loading && <p className="mt-6 text-[15px] text-label-alt">⏳ 두 채널을 분석하고 있어요…</p>}
      {error && (
        <p className="mt-6 rounded-frame border border-line-normal bg-bg-alt p-4 text-[15px] text-status-negative">
          ⚠ {error}
        </p>
      )}

      {pair && kw && (
        <div className="mt-8 space-y-6">
          <h2 className="text-[24px] font-bold text-label-normal">
            📊 {pair.a.channelTitle} vs {pair.b.channelTitle}
          </h2>

          <table className="w-full">
            <thead>
              <tr className="border-b border-line-normal">
                <th className="py-2 text-left text-[15px] text-label-alt">지표</th>
                <th className="py-2 text-right text-[15px] text-label-alt">{pair.a.channelTitle}</th>
                <th className="py-2 text-right text-[15px] text-label-alt">{pair.b.channelTitle}</th>
              </tr>
            </thead>
            <tbody>
              <KpiRow
                label="구독자"
                a={formatKoreanCount(pair.a.channelStats.subscriberCount)}
                b={formatKoreanCount(pair.b.channelStats.subscriberCount)}
                raw={[pair.a.channelStats.subscriberCount, pair.b.channelStats.subscriberCount]}
              />
              <KpiRow
                label="총 영상"
                a={pair.a.channelStats.videoCount.toLocaleString()}
                b={pair.b.channelStats.videoCount.toLocaleString()}
                raw={[pair.a.channelStats.videoCount, pair.b.channelStats.videoCount]}
              />
              <KpiRow
                label="최근 평균 조회"
                a={formatKoreanCount(pair.a.channelStats.avgRecentViews)}
                b={formatKoreanCount(pair.b.channelStats.avgRecentViews)}
                raw={[pair.a.channelStats.avgRecentViews, pair.b.channelStats.avgRecentViews]}
              />
            </tbody>
          </table>

          <div className="space-y-4">
            <h3 className="text-[20px] font-semibold text-label-normal">🏷 주요 주제</h3>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">공통</p>
              <KeywordChips words={kw.common} />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">{pair.a.channelTitle}만</p>
              <KeywordChips words={kw.onlyA} />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">{pair.b.channelTitle}만</p>
              <KeywordChips words={kw.onlyB} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 홈 페이지에 비교 링크 추가**

`app/page.tsx` 상단 import 구역에 `Link` import 추가:

```tsx
import { useState } from 'react';
```
바로 아래에 추가:
```tsx
import Link from 'next/link';
```

그리고 헤더 `<h1>`을 flex 컨테이너로 교체:

```tsx
      <h1 className="mb-6 text-[28px] font-bold text-label-normal">
        🎬 YouTube 콘텐츠 추천기
      </h1>
```
→
```tsx
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-label-normal">
          🎬 YouTube 콘텐츠 추천기
        </h1>
        <Link href="/compare" className="text-[15px] text-primary hover:underline">
          여러 채널 비교 →
        </Link>
      </div>
```

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공 — `/`와 `/compare` 두 페이지 컴파일.

Run: `npm run test`
Expected: PASS — 33개(기존 28 + compare 5).

- [ ] **Step 4: 커밋**

```bash
git add app/compare/page.tsx app/page.tsx
git commit -m "feat: add /compare page for two-channel comparison"
```

---

### Task 3: 최종 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트 + 빌드 재확인**

Run: `npm run test && npm run build`
Expected: 33개 PASS, 빌드 성공.

- [ ] **Step 2 (선택): 수동 동작 확인**

`.env`에 `YOUTUBE_API_KEY`가 있는 상태에서 `npm run dev`:
1. 홈에서 "여러 채널 비교 →" 클릭 → `/compare` 이동.
2. 두 채널 URL 입력 후 "비교" → KPI 표(행별 큰 값 강조) + 공통/각자 주제 칩 렌더.
3. 한쪽 URL을 잘못 입력 → 어느 채널이 실패했는지 에러 배너.
4. 같은 두 채널 재비교 → 빠르게 응답(개별 분석 캐시 히트).

- [ ] **Step 3: PR 준비 (사용자 요청 시)**

`feat/multi-channel-compare` → PR 생성. (커밋·푸시·PR은 사용자 확인 후 진행.)

---

## Self-Review

**Spec coverage:**
- 2개 고정, KPI + 주요 주제 비교 → Task 2 KPI 표 + 주제 3그룹 ✓
- 별도 `/compare` 페이지 → Task 2 Step 1 ✓
- KPI 더 큰 값 강조 → `KpiRow`의 aWins/bWins ✓
- 키워드 공통/A만/B만 + 순서 보존 → Task 1 `compareKeywords` + 테스트 ✓
- `/api/analyze` 재사용·서버 변경 0 → Task 2가 `fetchAnalyze`로 기존 엔드포인트 호출, 라우트 미수정 ✓
- 에러: 실패 채널 식별 → `Promise.allSettled` + 채널 A/B 라벨 ✓
- 양쪽 페이지 상호 링크 → Task 2 Step 1(← 단일 채널 분석) + Step 2(여러 채널 비교 →) ✓
- 상태 4종 → Empty/loading/error/pair 분기 ✓

**Placeholder scan:** 모든 step에 실제 코드/명령/기대출력. 플레이스홀더 없음 ✓

**Type consistency:** `compareKeywords(a, b)` → `{ common, onlyA, onlyB }`(Task 1) ↔ Task 2에서 `kw.common/onlyA/onlyB` 사용 일치 ✓. `AnalysisResult.channelStats`(subscriberCount/videoCount/avgRecentViews), `channelKeywords`, `channelTitle` — 기존 `types/analysis.ts`와 일치 ✓. `formatKoreanCount`는 `@/lib/analysis` 기존 export ✓. Tailwind 클래스(rounded-frame, bg-fill-normal, text-label-neutral 등)는 기존 `app/page.tsx`에서 사용 중 ✓.
