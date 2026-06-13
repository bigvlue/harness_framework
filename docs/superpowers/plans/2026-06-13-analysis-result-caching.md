# 분석 결과 캐싱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 채널 재요청 시 인메모리 TTL 캐시로 YouTube API 호출 없이 응답해 쿼터를 절약한다.

**Architecture:** 순수·테스트 가능한 제네릭 TTL 캐시 모듈(`lib/cache.ts`)을 신설하고, 분석 라우트(`app/api/analyze/route.ts`)에서 모듈 레벨 싱글톤으로 사용한다. 키는 기존 `parseChannelInput`으로 정규화한 `${type}:${value}`. 성공한 `AnalysisResult`만 캐싱하고, 리포트는 캐시 히트 시에도 저렴한 순수 함수로 재계산한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Vitest 2.

설계 근거: `docs/superpowers/specs/2026-06-13-analysis-result-caching-design.md`

---

## File Structure

- **Create** `lib/cache.ts` — 제네릭 TTL 캐시. `createCache<T>(ttlMs)` → `{ get, set }`, 상수 `ANALYSIS_TTL_MS`. 네트워크·타이머 의존 없음(시간은 `now` 인자 주입).
- **Create** `lib/cache.test.ts` — 캐시 단위 테스트.
- **Modify** `app/api/analyze/route.ts` — 캐시 싱글톤 생성 + get/set 배선(~10줄).

기존 결정 사항: 인메모리 Map, TTL 6시간, 강제 새로고침 제외(YAGNI).

## 사전 준비 (브랜치)

현재 `main`. 구현 커밋 전에 기능 브랜치를 만든다.

```bash
git checkout -b feat/analysis-cache
```

---

### Task 1: TTL 캐시 모듈 (`lib/cache.ts`)

**Files:**
- Create: `lib/cache.ts`
- Test: `lib/cache.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createCache, ANALYSIS_TTL_MS } from './cache';

describe('createCache', () => {
  const TTL = 1000; // 1초

  it('set 직후 get은 값을 반환한다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', 0)).toBe(42);
  });

  it('TTL 만료 직전(now = 저장시각 + ttl - 1)은 히트', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', TTL - 1)).toBe(42);
  });

  it('TTL 경계(now = 저장시각 + ttl)와 그 이후는 미스(undefined)', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', TTL)).toBeUndefined();
    expect(cache.get('a', TTL + 5000)).toBeUndefined();
  });

  it('없는 키는 undefined', () => {
    const cache = createCache<number>(TTL);
    expect(cache.get('missing', 0)).toBeUndefined();
  });

  it('키는 서로 격리된다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    expect(cache.get('a', 0)).toBe(1);
    expect(cache.get('b', 0)).toBe(2);
  });

  it('같은 키 재 set은 값과 저장시각을 갱신한다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 1, 0);
    cache.set('a', 2, 500); // 갱신: 새 저장시각 500
    expect(cache.get('a', 500)).toBe(2);
    // 갱신 시각 기준으로 만료가 다시 계산됨: 500 + 1000 = 1500
    expect(cache.get('a', 1499)).toBe(2);
    expect(cache.get('a', 1500)).toBeUndefined();
  });

  it('ANALYSIS_TTL_MS는 6시간', () => {
    expect(ANALYSIS_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/cache.test.ts`
Expected: FAIL — `Failed to resolve import "./cache"` (모듈 없음).

- [ ] **Step 3: 최소 구현**

Create `lib/cache.ts`:

```ts
export interface Cache<T> {
  get(key: string, now: number): T | undefined;
  set(key: string, value: T, now: number): void;
}

/**
 * 인메모리 TTL 캐시. 시간은 `now`(밀리초)를 인자로 받아 주입하므로
 * 실제 타이머 없이 만료를 단위 테스트할 수 있다.
 * 저장 시각 + ttlMs <= now 이면 만료(미스).
 */
export function createCache<T>(ttlMs: number): Cache<T> {
  const store = new Map<string, { value: T; storedAt: number }>();
  return {
    get(key, now) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.storedAt + ttlMs <= now) return undefined;
      return entry.value;
    },
    set(key, value, now) {
      store.set(key, { value, storedAt: now });
    },
  };
}

/** 분석 결과 캐시 TTL: 6시간 */
export const ANALYSIS_TTL_MS = 6 * 60 * 60 * 1000;
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/cache.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/cache.ts lib/cache.test.ts
git commit -m "feat: add in-memory TTL cache module"
```

---

### Task 2: 분석 라우트에 캐시 배선 (`app/api/analyze/route.ts`)

**Files:**
- Modify: `app/api/analyze/route.ts`

라우트는 단위 테스트 대상이 아니므로(네트워크 의존), 타입 체크(`npm run build`)와 전체 테스트로 검증한다.

- [ ] **Step 1: 라우트 수정**

Replace the entire contents of `app/api/analyze/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { analyzeChannel } from '@/lib/youtube';
import { buildReport } from '@/lib/report';
import { parseChannelInput } from '@/lib/analysis';
import { createCache, ANALYSIS_TTL_MS } from '@/lib/cache';
import type { AnalysisResult } from '@/types/analysis';

// 같은 채널 재요청 시 YouTube API 쿼터를 아끼기 위한 인메모리 캐시(서버 프로세스 내).
const cache = createCache<AnalysisResult>(ANALYSIS_TTL_MS);

export async function POST(req: Request) {
  try {
    const { channelUrl } = await req.json();
    if (!channelUrl || typeof channelUrl !== 'string') {
      return NextResponse.json({ error: '채널 URL을 입력하세요.' }, { status: 400 });
    }

    const ref = parseChannelInput(channelUrl);
    const key = `${ref.type}:${ref.value}`;
    const now = Date.now();

    let result = cache.get(key, now);
    if (!result) {
      result = await analyzeChannel(channelUrl, new Date(now));
      cache.set(key, result, now); // 성공 결과만 캐싱(에러는 throw로 전파, 캐싱 안 됨)
    }

    const report = buildReport(result);
    return NextResponse.json({ result, report });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

변경 요지: `parseChannelInput`·`createCache`·`ANALYSIS_TTL_MS`·`AnalysisResult` import 추가, 모듈 레벨 `cache` 싱글톤, 캐시 get→미스 시 `analyzeChannel`+set, `new Date()` → `new Date(now)`로 캐시 시각과 일치.

- [ ] **Step 2: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공(타입 에러 없음, 라우트 컴파일 OK).

Run: `npm run test`
Expected: PASS — 기존 21개 + cache 7개 = 28개.

- [ ] **Step 3: 커밋**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: cache analysis results per channel to save API quota"
```

---

### Task 3: 최종 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트 + 빌드 통과 재확인**

Run: `npm run test && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 2 (선택): 캐시 히트 수동 확인**

`.env`에 `YOUTUBE_API_KEY`가 있는 상태에서:

```bash
npm run dev
```

같은 채널 URL로 분석을 2회 실행. 2번째 응답이 즉시 반환되고(네트워크 지연 없음), 서버 콘솔에 YouTube fetch 로그가 추가로 찍히지 않으면 캐시 히트. (TTL 6h 내)

- [ ] **Step 3: PR 준비 (사용자 요청 시)**

기존 워크플로우대로 `feat/analysis-cache` → PR 생성. (커밋·푸시·PR은 사용자 확인 후 진행.)

---

## Self-Review

**Spec coverage:**
- 인메모리 Map → `createCache`의 `Map` store ✓ (Task 1)
- TTL 6시간 → `ANALYSIS_TTL_MS` + 테스트 ✓ (Task 1)
- 강제 새로고침 제외 → 미구현(YAGNI) ✓
- 키 `${ref.type}:${ref.value}` (parseChannelInput) → Task 2 ✓
- 히트 시 결과 반환 + report 재계산 → Task 2 ✓
- 성공 결과만 캐싱(에러 비캐싱) → `set`이 `analyzeChannel` 성공 후에만 호출 ✓ (Task 2)
- TDD(만료 경계/미스/격리/갱신) → Task 1 테스트 ✓

**Placeholder scan:** 모든 step에 실제 코드/명령/기대출력 포함. 플레이스홀더 없음 ✓

**Type consistency:** `createCache<T>(ttlMs)`, `get(key, now)`, `set(key, value, now)`, `ANALYSIS_TTL_MS`, `Cache<T>` — Task 1 정의와 Task 2 사용처 시그니처 일치 ✓. `AnalysisResult`는 기존 `types/analysis.ts`의 타입 재사용 ✓.
