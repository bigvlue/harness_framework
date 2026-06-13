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
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}
