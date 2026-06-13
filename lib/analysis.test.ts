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
});
