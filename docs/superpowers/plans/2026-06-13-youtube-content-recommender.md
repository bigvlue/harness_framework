# YouTube 채널 분석 & 다음 콘텐츠 추천기 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 YouTube 채널을 분석해 주요 주제·바이럴 유사 콘텐츠를 찾고, 통계 기반으로 다음 콘텐츠 5개를 추천하는 대시보드형 Next.js 웹 앱(MVP)을 Wanted 디자인 시스템에 맞춰 만든다.

**Architecture:** 브라우저에서 채널 URL 입력 → 서버 라우트 핸들러 `app/api/analyze`가 YouTube Data API v3를 호출하고 분석/추천 수행 → 브라우저에 KPI 타일 + 2×2 패널 대시보드 표시 + `report.md` 다운로드. 순수 로직(키워드·랭킹·추천·숫자포맷)은 네트워크 없는 `lib/analysis.ts`에 두고 단위 테스트, 네트워크 호출은 `lib/youtube.ts`에 격리.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS 3, Vitest, YouTube Data API v3, Pretendard JP(CDN).

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs,
tailwind.config.ts, postcss.config.mjs, vitest.config.ts   # 스캐폴드/설정
.env.local                # YOUTUBE_API_KEY (커밋 금지)
.env.example              # 키 양식
app/
  globals.css             # tailwind 지시문
  layout.tsx              # 루트 레이아웃 + Pretendard JP + 배경
  page.tsx                # 입력창 + 대시보드 (클라이언트)
  api/analyze/route.ts    # 분석 API (서버, YouTube 호출 전담)
lib/
  analysis.ts             # 순수 함수: 파싱/토큰화/키워드/랭킹/추천/숫자포맷
  analysis.test.ts
  youtube.ts              # YouTube API 호출 + analyzeChannel
  report.ts               # AnalysisResult → Markdown
  report.test.ts
types/
  analysis.ts             # 공용 타입
```

**책임 분리 근거:** `lib/analysis.ts`는 네트워크 의존이 없어 단위 테스트 가능. `lib/youtube.ts`는 얇은 fetch 래퍼라 빌드/수동 검증. CLAUDE.md CRITICAL 규칙(API 로직은 라우트 핸들러에서만, 클라이언트 직접 호출 금지)에 따라 모든 fetch는 서버에서만 실행.

**디자인 토큰(Wanted Design System):** Task 1에서 `tailwind.config.ts`에 등록해 `bg-primary`, `text-label-alt`, `shadow-sm`, `rounded-frame`, `bg-accent-cyan` 같은 시맨틱 클래스로 사용. 라이트 테마 전용.

---

## Task 1: 프로젝트 스캐폴드 + 디자인 토큰 + 환경 변수

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (임시 스켈레톤)
- Create: `.env.local`, `.env.example`
- Modify: `.gitignore` (`.env.local` 추가)

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "youtube-content-recommender",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config / postcss / vitest 설정 생성**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node', include: ['**/*.test.ts'] },
});
```

- [ ] **Step 4: tailwind.config.ts 생성 (Wanted 디자인 토큰)**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0066FF', strong: '#005EEB', heavy: '#0054D1' },
        label: {
          normal: '#171719',
          neutral: '#2E2F33E0',
          alt: '#37383C9C',
          assistive: '#37383C47',
          disable: '#37383C29',
        },
        bg: { normal: '#FFFFFF', alt: '#F7F7F8' },
        line: { normal: '#E1E2E4', neutral: '#EAEBEC', strong: '#AEB0B6' },
        fill: { normal: '#70737C14', strong: '#70737C29' },
        status: { positive: '#00BF40', cautionary: '#FF9200', negative: '#FF4242' },
        accent: {
          redorange: '#FF5E00',
          lime: '#58CF04',
          cyan: '#00BDDE',
          lightblue: '#00AEFF',
          violet: '#6541F2',
          purple: '#CB59FF',
          pink: '#F553DA',
        },
      },
      borderRadius: { frame: '14px' },
      boxShadow: {
        xs: '0 1px 2px #1717171A',
        sm: '0 4px 6px #1717170F, 0 2px 4px #1717170F',
        md: '0 10px 15px #17171712, 0 4px 6px #17171712',
        lg: '0 16px 24px #17171714, 0 6px 10px #17171714',
      },
      fontFamily: {
        sans: ['"Pretendard JP"', '"Pretendard"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: app 스켈레톤 + 폰트 생성**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`app/layout.tsx`:
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'YouTube 콘텐츠 추천기',
  description: '채널 분석 + 다음 콘텐츠 추천',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard JP (CDN). 차단 시 system-ui 폴백 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard-jp/dist/web/static/pretendard-jp.css"
        />
      </head>
      <body className="bg-bg-normal font-sans text-label-normal antialiased">
        {children}
      </body>
    </html>
  );
}
```

`app/page.tsx` (임시 — Task 6에서 교체):
```tsx
export default function Home() {
  return <main className="p-8">setup ok</main>;
}
```

- [ ] **Step 6: 환경 변수 파일 생성**

`.env.example`:
```
# Google Cloud Console에서 YouTube Data API v3 활성화 후 발급한 키
YOUTUBE_API_KEY=
```

`.env.local`:
```
YOUTUBE_API_KEY=
```

- [ ] **Step 7: .gitignore에 .env.local 추가**

`.gitignore` 파일 끝에 추가:
```
.env.local
```

- [ ] **Step 8: 설치 후 빌드로 검증**

Run:
```bash
npm install
npm run build
```
Expected: 설치 성공, `next build`가 에러 없이 완료(스켈레톤 page 컴파일).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts app .env.example .gitignore
git commit -m "chore: scaffold Next.js app with Wanted design tokens, Pretendard JP, env files"
```

---

## Task 2: 공용 타입 + 순수 분석 함수 (TDD)

**Files:**
- Create: `types/analysis.ts`
- Create: `lib/analysis.test.ts`
- Create: `lib/analysis.ts`

- [ ] **Step 1: 타입 정의 작성**

`types/analysis.ts`:
```ts
export interface VideoStat {
  videoId: string;
  title: string;
  channelId?: string; // 자기 채널 영상 제외용 (표시 이름 대신 ID로 비교)
  channelTitle: string;
  viewCount: number;
  publishedAt: string; // ISO 8601
  url: string;
  tags?: string[];
}

export interface Recommendation {
  topic: string;
  rationale: string; // 근거: 어떤 바이럴 영상 + 조회수
  fit: string;       // 채널 적합성 한 줄
  expansion: boolean; // true=확장 기회(채널이 안 다룸), false=강화 추천
}

export interface ChannelStats {
  subscriberCount: number;
  videoCount: number;
  avgRecentViews: number; // 최근 25개 평균 조회수
}

export interface AnalysisResult {
  channelTitle: string;
  channelStats: ChannelStats;
  channelKeywords: string[];
  channelBest: VideoStat[];
  viralVideos: VideoStat[];
  recommendations: Recommendation[];
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/analysis.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  parseChannelInput,
  tokenize,
  topKeywords,
  scoreVideo,
  rankVideos,
  extractRecommendations,
  formatKoreanCount,
} from './analysis';
import type { VideoStat } from '@/types/analysis';

describe('parseChannelInput', () => {
  it('@handle URL에서 handle 추출', () => {
    expect(parseChannelInput('https://www.youtube.com/@coolmoonchoi')).toEqual({
      type: 'handle',
      value: 'coolmoonchoi',
    });
  });
  it('/channel/UC... URL에서 id 추출', () => {
    expect(parseChannelInput('https://www.youtube.com/channel/UC1234567890abcdefghIJKL')).toEqual({
      type: 'id',
      value: 'UC1234567890abcdefghIJKL',
    });
  });
  it('맨앞 @ 없는 핸들도 handle로 처리', () => {
    expect(parseChannelInput('coolmoonchoi')).toEqual({ type: 'handle', value: 'coolmoonchoi' });
  });
});

describe('tokenize', () => {
  it('소문자화하고 2글자 미만/불용어 제거', () => {
    expect(tokenize('The BEST Cooking a')).toEqual(['best', 'cooking']);
  });
  it('한글과 영문을 분리 추출', () => {
    const toks = tokenize('맛있는 ramen 레시피');
    expect(toks).toContain('ramen');
    expect(toks).toContain('맛있는');
    expect(toks).toContain('레시피');
  });
});

describe('topKeywords', () => {
  it('빈도 상위 키워드를 n개 반환', () => {
    const texts = ['ramen ramen sushi', 'ramen tempura', 'sushi'];
    expect(topKeywords(texts, 2)).toEqual(['ramen', 'sushi']);
  });
});

describe('scoreVideo / rankVideos', () => {
  const now = new Date('2026-06-13T00:00:00Z');
  it('조회수 높은 영상이 더 높은 점수', () => {
    const high = scoreVideo(100000, '2026-06-01T00:00:00Z', now);
    const low = scoreVideo(1000, '2026-06-01T00:00:00Z', now);
    expect(high).toBeGreaterThan(low);
  });
  it('rankVideos는 점수 내림차순으로 limit개 반환', () => {
    const vids: VideoStat[] = [
      { videoId: 'a', title: 'A', channelTitle: 'c', viewCount: 10, publishedAt: '2026-06-01T00:00:00Z', url: '' },
      { videoId: 'b', title: 'B', channelTitle: 'c', viewCount: 1000, publishedAt: '2026-06-01T00:00:00Z', url: '' },
      { videoId: 'c', title: 'C', channelTitle: 'c', viewCount: 100, publishedAt: '2026-06-01T00:00:00Z', url: '' },
    ];
    const ranked = rankVideos(vids, now, 2);
    expect(ranked.map((v) => v.videoId)).toEqual(['b', 'c']);
  });
});

describe('extractRecommendations', () => {
  const now = '2026-06-13T00:00:00Z';
  const viral: VideoStat[] = [
    { videoId: '1', title: 'mukbang challenge', channelTitle: 'x', viewCount: 500000, publishedAt: now, url: 'u1' },
    { videoId: '2', title: 'mukbang spicy', channelTitle: 'y', viewCount: 300000, publishedAt: now, url: 'u2' },
  ];
  it('후보 키워드 범위 내에서 최대 n개 반환', () => {
    expect(extractRecommendations(viral, ['ramen'], 5).length).toBeLessThanOrEqual(5);
    expect(extractRecommendations(viral, ['ramen'], 5).length).toBeGreaterThan(0);
  });
  it('채널이 안 다룬 키워드(gap)를 우선 추천 + expansion=true', () => {
    const recs = extractRecommendations(viral, ['ramen'], 1);
    expect(recs[0].topic).toContain('mukbang');
    expect(recs[0].expansion).toBe(true);
    expect(recs[0].fit).toContain('확장 기회');
  });
  it('채널이 이미 다루는 키워드는 강화 추천(expansion=false)', () => {
    const recs = extractRecommendations(viral, ['mukbang'], 1);
    expect(recs[0].expansion).toBe(false);
    expect(recs[0].fit).toContain('강화 추천');
  });
});

describe('formatKoreanCount', () => {
  it('만/억 단위로 축약', () => {
    expect(formatKoreanCount(840000)).toBe('84만');
    expect(formatKoreanCount(1200000)).toBe('120만');
    expect(formatKoreanCount(120000000)).toBe('1.2억');
    expect(formatKoreanCount(950)).toBe('950');
  });
  it('천만 단위에서 로케일 쉼표 없이 결정적으로 표시', () => {
    expect(formatKoreanCount(12000000)).toBe('1200만');
  });
});
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run: `npm run test`
Expected: FAIL — `./analysis` 모듈/함수 없음.

- [ ] **Step 4: 구현 작성**

`lib/analysis.ts`:
```ts
import type { VideoStat, Recommendation } from '@/types/analysis';

export type ChannelRef = { type: 'id'; value: string } | { type: 'handle'; value: string };

const STOPWORDS = new Set([
  // 영어
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'this', 'that', 'how', 'what', 'you', 'your', 'my',
  // 한국어 빈출
  '그리고', '하는', '하기', '이것', '저것', '정말', '진짜', '너무', '오늘',
  '우리', '내가', '나의', '영상', '구독', '좋아요', '채널',
]);

export function parseChannelInput(input: string): ChannelRef {
  const s = input.trim();
  const channelMatch = s.match(/\/channel\/(UC[\w-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  if (/^UC[\w-]{20,}$/.test(s)) return { type: 'id', value: s };
  const handleMatch = s.match(/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  return { type: 'handle', value: s.replace(/^\/+|\/+$/g, '') };
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+|[가-힣]+/g) ?? []).filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );
}

export function topKeywords(texts: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const tok of tokenize(text)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

export function scoreVideo(viewCount: number, publishedAt: string, now: Date): number {
  const ageDays = Math.max(1, (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000);
  return viewCount + viewCount / ageDays;
}

export function rankVideos(videos: VideoStat[], now: Date, limit: number): VideoStat[] {
  return [...videos]
    .sort(
      (a, b) =>
        scoreVideo(b.viewCount, b.publishedAt, now) -
        scoreVideo(a.viewCount, a.publishedAt, now),
    )
    .slice(0, limit);
}

export function extractRecommendations(
  viralVideos: VideoStat[],
  channelKeywords: string[],
  n: number,
): Recommendation[] {
  const channelSet = new Set(channelKeywords);
  const counts = new Map<string, { count: number; top: VideoStat }>();
  for (const v of viralVideos) {
    for (const tok of tokenize(v.title)) {
      const entry = counts.get(tok);
      if (entry) entry.count += 1;
      else counts.set(tok, { count: 1, top: v });
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count; // 빈도 높은 순
      const aGap = channelSet.has(a[0]) ? 0 : 1;
      const bGap = channelSet.has(b[0]) ? 0 : 1;
      return bGap - aGap; // 빈도 동일 시 gap(미커버) 우선
    })
    .slice(0, n);

  return ranked.map(([word, { top }]) => {
    const expansion = !channelSet.has(word);
    return {
      topic: `"${word}" 주제 콘텐츠`,
      rationale: `바이럴 영상 「${top.title}」 (${top.viewCount.toLocaleString()}회)에서 자주 등장한 키워드`,
      fit: expansion ? '채널이 아직 안 다룬 주제 — 확장 기회' : '채널이 이미 다루는 주제 — 강화 추천',
      expansion,
    };
  });
}

export function formatKoreanCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`; // 로케일 쉼표 방지(결정적)
  return n.toLocaleString();
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `npm run test`
Expected: PASS — analysis 테스트 전부 통과.

- [ ] **Step 6: Commit**

```bash
git add types/analysis.ts lib/analysis.ts lib/analysis.test.ts
git commit -m "feat: add pure analysis functions (tokenize, rank, recommend, format) with tests"
```

---

## Task 3: Markdown 리포트 생성 (TDD)

**Files:**
- Create: `lib/report.test.ts`
- Create: `lib/report.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/report.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildReport } from './report';
import type { AnalysisResult } from '@/types/analysis';

const sample: AnalysisResult = {
  channelTitle: '쿨문초이',
  channelStats: { subscriberCount: 1200000, videoCount: 342, avgRecentViews: 840000 },
  channelKeywords: ['ramen', 'mukbang'],
  channelBest: [
    { videoId: 'a', title: '최고 라멘', channelTitle: '쿨문초이', viewCount: 12345, publishedAt: '2026-05-01T00:00:00Z', url: 'https://youtu.be/a' },
  ],
  viralVideos: [
    { videoId: 'b', title: '매운 먹방', channelTitle: '다른채널', viewCount: 500000, publishedAt: '2026-06-01T00:00:00Z', url: 'https://youtu.be/b' },
  ],
  recommendations: [
    { topic: '"매운" 주제 콘텐츠', rationale: '바이럴 영상 「매운 먹방」', fit: '확장 기회', expansion: true },
  ],
};

describe('buildReport', () => {
  it('채널명과 모든 섹션 제목, KPI 요약을 포함', () => {
    const md = buildReport(sample);
    expect(md).toContain('# 쿨문초이');
    expect(md).toContain('구독자');     // KPI 요약 줄
    expect(md).toContain('## 채널 주요 주제');
    expect(md).toContain('## 채널 베스트 영상');
    expect(md).toContain('## 요즘 바이럴한 유사 콘텐츠');
    expect(md).toContain('## 다음 콘텐츠 추천');
  });
  it('영상 링크와 추천 내용을 포함', () => {
    const md = buildReport(sample);
    expect(md).toContain('https://youtu.be/b');
    expect(md).toContain('"매운" 주제 콘텐츠');
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm run test`
Expected: FAIL — `./report` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`lib/report.ts`:
```ts
import type { AnalysisResult } from '@/types/analysis';
import { formatKoreanCount } from './analysis';

export function buildReport(r: AnalysisResult): string {
  const sections: string[] = [];

  sections.push(`# ${r.channelTitle} — 콘텐츠 분석 리포트`);

  sections.push(
    `> 구독자 ${formatKoreanCount(r.channelStats.subscriberCount)} · ` +
      `총 영상 ${r.channelStats.videoCount.toLocaleString()}개 · ` +
      `최근 평균 조회 ${formatKoreanCount(r.channelStats.avgRecentViews)}`,
  );

  sections.push(
    `## 채널 주요 주제\n` + r.channelKeywords.map((k) => `- ${k}`).join('\n'),
  );

  sections.push(
    `## 채널 베스트 영상\n` +
      r.channelBest
        .map((v) => `- [${v.title}](${v.url}) — ${v.viewCount.toLocaleString()}회`)
        .join('\n'),
  );

  sections.push(
    `## 요즘 바이럴한 유사 콘텐츠\n` +
      r.viralVideos
        .map(
          (v) =>
            `- [${v.title}](${v.url}) (${v.channelTitle}) — ${v.viewCount.toLocaleString()}회`,
        )
        .join('\n'),
  );

  sections.push(
    `## 다음 콘텐츠 추천 5개\n` +
      r.recommendations
        .map(
          (rec, i) =>
            `${i + 1}. **${rec.topic}**\n   - 근거: ${rec.rationale}\n   - 적합성: ${rec.fit}`,
        )
        .join('\n'),
  );

  return sections.join('\n\n') + '\n';
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/report.ts lib/report.test.ts
git commit -m "feat: add markdown report builder with KPI summary and tests"
```

---

## Task 4: YouTube API 네트워크 계층 + 오케스트레이션

**Files:**
- Create: `lib/youtube.ts`

네트워크 의존이라 단위 테스트 대신 타입 체크/빌드로 검증하고 Task 7에서 실제 키로 수동 검증.

- [ ] **Step 1: 구현 작성**

`lib/youtube.ts`:
```ts
import {
  parseChannelInput,
  topKeywords,
  rankVideos,
  extractRecommendations,
  type ChannelRef,
} from './analysis';
import type { AnalysisResult, VideoStat } from '@/types/analysis';

const API = 'https://www.googleapis.com/youtube/v3';

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.');
  return k;
}

async function call(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey());
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API 오류 (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function resolveChannel(ref: ChannelRef): Promise<{
  channelId: string;
  title: string;
  uploadsPlaylist: string;
  subscriberCount: number;
  videoCount: number;
}> {
  const params: Record<string, string> = { part: 'snippet,contentDetails,statistics' };
  if (ref.type === 'id') params.id = ref.value;
  else params.forHandle = ref.value;
  const data = await call('channels', params);
  const item = data.items?.[0];
  if (!item) throw new Error('채널을 찾을 수 없습니다. URL을 확인하세요.');
  return {
    channelId: item.id,
    title: item.snippet.title,
    uploadsPlaylist: item.contentDetails.relatedPlaylists.uploads,
    subscriberCount: Number(item.statistics.subscriberCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
  };
}

async function getRecentVideoIds(uploadsPlaylist: string, max: number): Promise<string[]> {
  const data = await call('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylist,
    maxResults: String(max),
  });
  return (data.items ?? []).map((i: any) => i.contentDetails.videoId);
}

async function getVideoDetails(ids: string[]): Promise<VideoStat[]> {
  if (ids.length === 0) return [];
  const data = await call('videos', { part: 'snippet,statistics', id: ids.join(',') });
  return (data.items ?? []).map((i: any) => ({
    videoId: i.id,
    title: i.snippet.title,
    channelId: i.snippet.channelId,
    channelTitle: i.snippet.channelTitle,
    viewCount: Number(i.statistics.viewCount ?? 0),
    publishedAt: i.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${i.id}`,
    tags: i.snippet.tags ?? [],
  }));
}

async function searchVideoIds(query: string, publishedAfter: string): Promise<string[]> {
  const data = await call('search', {
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    q: query,
    maxResults: '10',
  });
  return (data.items ?? []).map((i: any) => i.id.videoId).filter(Boolean);
}

export async function analyzeChannel(input: string, now: Date): Promise<AnalysisResult> {
  const channel = await resolveChannel(parseChannelInput(input));

  const recentIds = await getRecentVideoIds(channel.uploadsPlaylist, 25);
  const channelVideos = await getVideoDetails(recentIds);

  const texts = channelVideos.flatMap((v) => [v.title, ...(v.tags ?? [])]);
  const keywords = topKeywords(texts, 8);
  const channelBest = rankVideos(channelVideos, now, 5);
  const avgRecentViews =
    channelVideos.length > 0
      ? Math.round(
          channelVideos.reduce((sum, v) => sum + v.viewCount, 0) / channelVideos.length,
        )
      : 0;

  const publishedAfter = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const searchKeywords = keywords.slice(0, 5);
  const idSets = await Promise.all(
    searchKeywords.map((k) => searchVideoIds(k, publishedAfter)),
  );
  const candidateIds = [...new Set(idSets.flat())].slice(0, 50); // videos.list 최대 50개
  const candidates = await getVideoDetails(candidateIds);
  const viralVideos = rankVideos(
    candidates.filter((v) => v.channelId !== channel.channelId),
    now,
    10,
  );

  const recommendations = extractRecommendations(viralVideos, keywords, 5);

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
}
```

- [ ] **Step 2: 타입 체크/빌드로 검증**

Run: `npm run build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add lib/youtube.ts
git commit -m "feat: add YouTube Data API client with channel stats and analyzeChannel"
```

---

## Task 5: 분석 API 라우트 핸들러

**Files:**
- Create: `app/api/analyze/route.ts`

- [ ] **Step 1: 구현 작성**

`app/api/analyze/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { analyzeChannel } from '@/lib/youtube';
import { buildReport } from '@/lib/report';

export async function POST(req: Request) {
  try {
    const { channelUrl } = await req.json();
    if (!channelUrl || typeof channelUrl !== 'string') {
      return NextResponse.json({ error: '채널 URL을 입력하세요.' }, { status: 400 });
    }
    const result = await analyzeChannel(channelUrl, new Date());
    const report = buildReport(result);
    return NextResponse.json({ result, report });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 빌드 성공, `/api/analyze` 라우트 인식.

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: add /api/analyze route handler"
```

---

## Task 6: 대시보드 UI (Wanted 디자인 시스템)

**Files:**
- Modify: `app/page.tsx` (Task 1의 임시 스켈레톤을 전체 교체)

KPI 타일 4개 + 2×2 패널 격자(채널 베스트 / 바이럴 / 주요 주제 / 추천). 조회수 막대는 패널 최댓값 대비 너비 비율, 차트 라이브러리 없음. 디자인 토큰 시맨틱 클래스 사용.

- [ ] **Step 1: 구현 작성**

`app/page.tsx` 전체 내용을 다음으로 교체:
```tsx
'use client';

import { useState } from 'react';
import type { AnalysisResult, VideoStat } from '@/types/analysis';
import { formatKoreanCount } from '@/lib/analysis';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-frame bg-bg-alt p-4 shadow-sm">
      <p className="text-[15px] text-label-alt">{label}</p>
      <p className="mt-1 text-[32px] font-bold leading-tight text-label-normal">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-frame border border-line-normal bg-bg-normal p-5 shadow-sm">
      <h2 className="mb-3 text-[20px] font-semibold text-label-normal">{title}</h2>
      {children}
    </div>
  );
}

function VideoBars({ videos, barClass }: { videos: VideoStat[]; barClass: string }) {
  const max = Math.max(1, ...videos.map((v) => v.viewCount));
  return (
    <ul className="space-y-2">
      {videos.map((v) => (
        <li key={v.videoId}>
          <a
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[15px] text-label-normal hover:text-primary"
          >
            {v.title}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill-normal">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{ width: `${Math.max(4, (v.viewCount / max) * 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[13px] text-label-alt">
              {formatKoreanCount(v.viewCount)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [url, setUrl] = useState('https://www.youtube.com/@coolmoonchoi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [report, setReport] = useState('');

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석에 실패했습니다.');
      setResult(data.result);
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const blob = new Blob([report], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report.md';
    a.click();
    // Firefox는 click() 후 비동기로 다운로드를 시작하므로 즉시 revoke하면 실패할 수 있음
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="mb-6 text-[28px] font-bold text-label-normal">
        🎬 YouTube 콘텐츠 추천기
      </h1>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="채널 URL"
          placeholder="채널 URL (예: https://www.youtube.com/@coolmoonchoi)"
        />
        <button
          className="rounded-frame bg-primary px-6 py-3 text-[16px] font-medium text-white hover:bg-primary-strong active:bg-primary-heavy disabled:opacity-50"
          onClick={analyze}
          disabled={loading || url.trim() === ''}
        >
          {loading ? '분석 중…' : '분석'}
        </button>
      </div>

      {!result && !error && !loading && (
        <p className="mt-6 text-[15px] text-label-alt">채널 주소를 넣고 분석을 눌러보세요.</p>
      )}
      {loading && (
        <p className="mt-6 text-[15px] text-label-alt">⏳ 채널을 분석하고 있어요 (보통 3~8초)…</p>
      )}
      {error && (
        <p className="mt-6 rounded-frame border border-line-normal bg-bg-alt p-4 text-[15px] text-status-negative">
          ⚠ {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <h2 className="text-[24px] font-bold text-label-normal">
            📊 {result.channelTitle} — 콘텐츠 대시보드
          </h2>

          {/* KPI 타일 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi label="구독자" value={formatKoreanCount(result.channelStats.subscriberCount)} />
            <Kpi label="총 영상" value={result.channelStats.videoCount.toLocaleString()} />
            <Kpi label="최근 평균 조회" value={formatKoreanCount(result.channelStats.avgRecentViews)} />
            <Kpi label="추천" value={`${result.recommendations.length}건`} />
          </div>

          {/* 2×2 패널 격자 */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Panel title="🏆 채널 베스트 영상">
              <VideoBars videos={result.channelBest} barClass="bg-accent-cyan" />
            </Panel>

            <Panel title="🔥 요즘 바이럴한 유사 콘텐츠">
              <VideoBars videos={result.viralVideos} barClass="bg-accent-redorange" />
            </Panel>

            <Panel title="🏷 주요 주제">
              <div className="flex flex-wrap gap-2">
                {result.channelKeywords.map((k) => (
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
            </Panel>

            <Panel title="💡 다음 콘텐츠 추천">
              <ol className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="rounded-frame bg-bg-alt p-3">
                    <p className="text-[16px] font-medium text-label-normal">
                      {i + 1}. {rec.topic}
                    </p>
                    <p className="mt-1 text-[15px] text-label-alt">근거: {rec.rationale}</p>
                    <p className="mt-1 text-[15px]">
                      <span
                        className={
                          rec.expansion ? 'text-primary' : 'text-status-positive'
                        }
                      >
                        {rec.expansion ? '↗ 확장 기회' : '● 강화 추천'}
                      </span>
                      <span className="text-label-alt"> — {rec.fit}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          {/* 하단 액션 */}
          <div className="flex gap-3">
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={download}
            >
              ⬇ report.md 다운로드
            </button>
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={() => {
                setResult(null);
                setReport('');
                setError('');
              }}
            >
              🔄 다른 채널 분석
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add dashboard UI with KPI tiles, panels, view-count bars (Wanted design tokens)"
```

---

## Task 7: 실제 키로 엔드투엔드 수동 검증

**Files:** (코드 변경 없음 — 검증 단계)

- [ ] **Step 1: API 키 설정 확인**

`.env.local`에 실제 YouTube Data API v3 키 입력:
```
YOUTUBE_API_KEY=AIza...실제키
```
키가 없으면 Google Cloud Console → APIs & Services → YouTube Data API v3 활성화 → 사용자 인증 정보에서 API 키 생성.

- [ ] **Step 2: 개발 서버 실행**

Run: `npm run dev`
브라우저에서 `http://localhost:3000` 접속.

- [ ] **Step 3: 대상 채널 분석**

입력창에 `https://www.youtube.com/@coolmoonchoi` 입력 후 "분석" 클릭.
Expected:
- 상단 KPI 타일(구독자/총영상/평균조회/추천) 표시
- 🏆 채널 베스트 / 🔥 바이럴 패널에 조회수 막대 표시
- 🏷 주요 주제 칩, 💡 추천 5개(확장/강화 뱃지) 표시
- Pretendard JP 폰트, 파란 Primary 버튼, 14px 라운드/그림자 적용 확인

- [ ] **Step 4: 리포트 다운로드 확인**

"⬇ report.md 다운로드" 클릭 → 마크다운 파일이 KPI 요약 + 4개 섹션을 담아 저장되는지 확인.

- [ ] **Step 5: 에러/재분석 확인**

- 키를 비우거나 잘못된 URL → 빨간 에러 배너 표시 확인
- "🔄 다른 채널 분석" → 입력 상태로 복귀 확인

---

## Self-Review 결과

- **Spec 커버리지:** 페르소나/저니/플로우(설계 반영), 채널 분석+KPI(Task 2,4), 바이럴 탐색(Task 4), 추천 5개(Task 2+4), 대시보드 KPI·패널·막대(Task 6), report.md(Task 3,6), Wanted 디자인 토큰(Task 1,6), env(Task 1), CLAUDE.md CRITICAL 규칙(서버 전용 fetch — Task 4,5) 모두 매핑됨.
- **Placeholder 스캔:** 모든 코드 단계에 실제 코드 포함. TBD/TODO 없음.
- **타입 일관성:** `VideoStat`(tags), `Recommendation`(topic/rationale/fit/expansion), `ChannelStats`(subscriberCount/videoCount/avgRecentViews), `AnalysisResult`가 정의 위치(Task 2)와 사용처(Task 3,4,6)에서 일치. `formatKoreanCount`는 Task 2에서 정의 후 Task 3·6에서 사용. 함수명 `analyzeChannel`/`buildReport`/`extractRecommendations` 일관.
- **디자인 토큰 일관성:** Task 1에서 등록한 클래스(`bg-primary`, `text-label-alt`, `bg-bg-alt`, `border-line-normal`, `rounded-frame`, `shadow-sm`, `bg-accent-cyan/redorange`, `bg-fill-normal`, `text-status-negative/positive`)만 Task 6에서 사용.
