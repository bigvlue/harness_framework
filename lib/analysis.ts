import type { VideoStat, Recommendation } from '@/types/analysis';

export type ChannelRef = { type: 'id'; value: string } | { type: 'handle'; value: string };

const STOPWORDS = new Set([
  // 영어
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'this', 'that', 'how', 'what', 'you', 'your', 'my',
  // 한국어 빈출
  '그리고', '하는', '하기', '이것', '저것', '정말', '진짜', '너무', '오늘',
  '우리', '내가', '나의', '영상', '구독', '좋아요', '채널',
  // 클릭베이트·상거래 상투어 (제목에서 주제어를 가리는 노이즈)
  '이번주', '이번', '모음', '무조건', '신제품', '제품', '가지', '느낌', '등장',
  '미친', '완전', '역대급', '드디어', '그냥', '이건', '가격', '구매', '추천',
  '리뷰', '같은', '대박', '최고', '최신', '공개', '출시', '사야할', '사고싶은',
  '갖고싶음', '직접', '과연', '결국', '처음', '이거', '그거', '저거', '요즘',
  '여기', '거기', '정도', '진심', '이게', '그게', '저게', '근데', '이런', '그런', '저런',
]);

// 명사 뒤에 붙어 같은 주제어를 다른 토큰으로 갈라놓는 조사들.
// 동사/형용사 어미(는/은) 및 명사 끝글자와 자주 겹치는 이/가는 의도적으로 제외해 오절단(고양이→고양)을 막는다.
// 긴 것부터 매칭한다.
const PARTICLES = ['에서', '으로', '까지', '들', '을', '를', '의', '로'];

function stripParticle(token: string): string {
  for (const p of PARTICLES) {
    if (token.endsWith(p) && token.length - p.length >= 2) {
      return token.slice(0, token.length - p.length);
    }
  }
  return token;
}

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
  const raw = text.toLowerCase().match(/[a-z0-9]+|[가-힣]+/g) ?? [];
  return raw
    .map((t) => (/[가-힣]/.test(t) ? stripParticle(t) : t))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

export function topKeywords(texts: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const tok of tokenize(text)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length) // 빈도 → 길이(구체성) 순
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
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}
