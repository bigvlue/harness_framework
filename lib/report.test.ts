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
  analyzedAt: '2026-06-14T12:00:00Z',
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
