# 강제 새로고침 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드에서 현재 채널을 캐시를 우회해 즉시 재분석하는 "강제 재분석" 기능을 추가한다.

**Architecture:** 라우트는 요청 body의 `refresh` 플래그가 true면 `cache.get`을 건너뛰고 분석 후 `cache.set`으로 덮어쓴다. 클라이언트는 `analyze(refresh)`로 파라미터화하고 대시보드에 버튼을 추가한다. 새 순수 로직이 없어 캐시 모듈은 변경하지 않으며, 검증은 빌드 + 기존 테스트 + 수동 확인으로 한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, React 19, Vitest 2.

설계 근거: `docs/superpowers/specs/2026-06-13-force-refresh-design.md`

---

## File Structure

- **Modify** `app/api/analyze/route.ts` — body에서 `refresh` 읽기, true면 캐시 우회 + 덮어쓰기.
- **Modify** `app/page.tsx` — `analyze(refresh=false)` 파라미터화, 기존 "분석" 버튼 `onClick` 보정, 대시보드에 "♻ 강제 재분석" 버튼 추가.

캐시 모듈(`lib/cache.ts`)·타입·기타 파일은 변경 없음.

## 사전 준비 (브랜치)

현재 `main`. 구현 커밋 전에 기능 브랜치를 만든다.

```bash
git checkout -b feat/force-refresh
```

---

### Task 1: 라우트에 refresh 처리 추가 (`app/api/analyze/route.ts`)

**Files:**
- Modify: `app/api/analyze/route.ts`

라우트는 네트워크 의존이라 단위 테스트 대상이 아니다. `npm run build`(타입) + `npm run test`(기존 28개 그린)로 검증한다.

- [ ] **Step 1: 라우트 수정**

`app/api/analyze/route.ts`에서 두 곳을 수정한다.

(1) 구조분해에 `refresh` 추가:

```ts
    const { channelUrl } = await req.json();
```
→
```ts
    const { channelUrl, refresh } = await req.json();
```

(2) 캐시 조회를 refresh일 때 우회:

```ts
    let result = cache.get(key, now);
    if (!result) {
      result = await analyzeChannel(channelUrl, new Date(now));
      cache.set(key, result, now); // 성공 결과만 캐싱(에러는 throw로 전파, 캐싱 안 됨)
    }
```
→
```ts
    // refresh=true면 캐시를 우회하고 새로 분석한 뒤 캐시를 덮어쓴다.
    let result = refresh === true ? undefined : cache.get(key, now);
    if (!result) {
      result = await analyzeChannel(channelUrl, new Date(now));
      cache.set(key, result, now); // 성공 결과만 캐싱(에러는 throw로 전파, 캐싱 안 됨)
    }
```

수정 후 파일 전체는 다음과 같아야 한다:

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
    const { channelUrl, refresh } = await req.json();
    if (!channelUrl || typeof channelUrl !== 'string') {
      return NextResponse.json({ error: '채널 URL을 입력하세요.' }, { status: 400 });
    }

    const ref = parseChannelInput(channelUrl);
    const key = `${ref.type}:${ref.value}`;
    const now = Date.now();

    // refresh=true면 캐시를 우회하고 새로 분석한 뒤 캐시를 덮어쓴다.
    let result = refresh === true ? undefined : cache.get(key, now);
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

- [ ] **Step 2: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공(타입 에러 없음).

Run: `npm run test`
Expected: PASS — 기존 28개 그대로(새 테스트 없음).

- [ ] **Step 3: 커밋**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: support refresh flag to bypass analysis cache"
```

---

### Task 2: 클라이언트에 강제 재분석 버튼 추가 (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: `analyze`를 파라미터화하고 body에 refresh 포함**

```ts
  async function analyze() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: url }),
      });
```
→
```ts
  async function analyze(refresh = false) {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: url, refresh }),
      });
```

- [ ] **Step 2: 기존 "분석" 버튼 onClick 보정 (함정)**

`onClick={analyze}`는 클릭 이벤트(React SyntheticEvent)를 `analyze`의 첫 인자(`refresh`)로 넘긴다. 이벤트 객체가 `JSON.stringify`에 들어가면 순환참조로 throw될 수 있으므로 화살표로 감싼다.

```tsx
          onClick={analyze}
          disabled={loading || url.trim() === ''}
        >
          {loading ? '분석 중…' : '분석'}
```
→
```tsx
          onClick={() => analyze()}
          disabled={loading || url.trim() === ''}
        >
          {loading ? '분석 중…' : '분석'}
```

- [ ] **Step 3: 대시보드 하단에 "♻ 강제 재분석" 버튼 추가**

하단 액션 `<div className="flex gap-3">`의 첫 자식으로 버튼을 추가한다.

```tsx
          {/* 하단 액션 */}
          <div className="flex gap-3">
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={download}
            >
              ⬇ report.md 다운로드
            </button>
```
→
```tsx
          {/* 하단 액션 */}
          <div className="flex gap-3">
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt disabled:opacity-50"
              onClick={() => analyze(true)}
              disabled={loading || url.trim() === ''}
            >
              ♻ 강제 재분석
            </button>
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={download}
            >
              ⬇ report.md 다운로드
            </button>
```

- [ ] **Step 4: 타입 체크 + 전체 테스트**

Run: `npm run build`
Expected: 성공(타입 에러 없음, `page.tsx` 컴파일 OK).

Run: `npm run test`
Expected: PASS — 기존 28개.

- [ ] **Step 5: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: add force re-analyze button to dashboard"
```

---

### Task 3: 최종 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트 + 빌드 재확인**

Run: `npm run test && npm run build`
Expected: 28개 PASS, 빌드 성공.

- [ ] **Step 2 (선택): 수동 동작 확인**

`.env`에 `YOUTUBE_API_KEY`가 있는 상태에서:

```bash
npm run dev
```

1. 채널 분석 1회 → 결과 표시.
2. "다른 채널 분석"으로 입력 복귀 후 같은 URL 재분석 → 즉시 반환(캐시 히트, 서버 콘솔에 YouTube fetch 로그 없음).
3. 대시보드에서 "♻ 강제 재분석" 클릭 → "⏳ 분석 중…" 표시 후 재렌더, 서버 콘솔에 YouTube fetch 로그 발생(캐시 우회). 이후 같은 채널 일반 재요청은 다시 캐시 히트(갱신된 결과).

- [ ] **Step 3: PR 준비 (사용자 요청 시)**

`feat/force-refresh` → PR 생성. (커밋·푸시·PR은 사용자 확인 후 진행.)

---

## Self-Review

**Spec coverage:**
- 대시보드 "♻ 강제 재분석" 버튼 → Task 2 Step 3 ✓
- 로딩 UX 기존 흐름 재사용 → `analyze(true)`가 기존 `analyze` 본문 사용(setResult(null)→loading→재렌더) ✓ (Task 2 Step 1)
- 라우트 `refresh===true` 시 get 생략 + set 덮어쓰기 → Task 1 Step 1 ✓
- 캐시 모듈 변경 없음 → 어떤 태스크도 `lib/cache.ts` 미수정 ✓
- 400/catch/응답 형태 불변 → Task 1의 수정은 구조분해와 get 한 줄에 한정 ✓
- 기존 "분석" 버튼 동작 불변(이벤트 인자 함정 차단) → Task 2 Step 2 ✓

**Placeholder scan:** 모든 step에 실제 코드/명령/기대출력 포함. 플레이스홀더 없음 ✓

**Type consistency:** 서버 `refresh === true` 비교(불리언), 클라이언트 `analyze(refresh = false)` 기본값 불리언, body `{ channelUrl, refresh }` — 서버 구조분해와 일치 ✓. `refresh`는 선택적이므로 기존 클라이언트(미전송)와도 호환(`undefined === true`는 false → 캐시 사용) ✓.
