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
  it('명사형 조사(들/을/를/의/에서/으로/까지)를 제거해 변형을 병합', () => {
    expect(tokenize('가방을 노래를')).toEqual(['가방', '노래']);
    expect(tokenize('서울에서 부산까지')).toEqual(['서울', '부산']);
  });
  it('동사/형용사 어미·명사 끝글자와 겹치는 은/는/이/가는 절단하지 않음', () => {
    expect(tokenize('고양이')).toEqual(['고양이']); // 이 보존
    expect(tokenize('맛있는')).toEqual(['맛있는']); // 는 보존
  });
  it('클릭베이트·상거래 상투어를 불용어로 제거', () => {
    expect(tokenize('이번주 무조건 사고싶은 신제품 제품들 모음')).toEqual([]);
  });
  it('영어 의문·필러 상투어를 불용어로 제거', () => {
    expect(tokenize('when vs which get this camera')).toEqual(['camera']);
  });
  it('순수 숫자 토큰은 검색 노이즈라 제거 (모델명의 영숫자는 유지)', () => {
    expect(tokenize('갤럭시 16 2026')).toEqual(['갤럭시']);
    expect(tokenize('rtx4090 11')).toEqual(['rtx4090']);
  });
});

describe('topKeywords', () => {
  it('빈도 상위 키워드를 n개 반환', () => {
    const texts = ['ramen ramen sushi', 'ramen tempura', 'sushi'];
    expect(topKeywords(texts, 2)).toEqual(['ramen', 'sushi']);
  });
  it('빈도가 같으면 더 긴(구체적) 토큰을 우선', () => {
    expect(topKeywords(['커피 아메리카노'], 2)).toEqual(['아메리카노', '커피']);
  });
  it('빈도가 길이보다 우선', () => {
    expect(topKeywords(['커피 커피 아메리카노'], 2)).toEqual(['커피', '아메리카노']);
  });
  it('여러 영상에 걸쳐 반복된 주제를, 한 영상에서만 여러 번 나온 단어보다 우선', () => {
    // dji: 영상 2개에 등장(DF 2, TF 2). '레전드'는 한 영상 제목에서만 반복(DF 1, TF 3).
    // DF 우선 정렬이므로 TF가 더 높아도 dji가 앞선다.
    const docs = ['dji 드론 촬영', 'dji 짐벌 후기', '레전드 레전드 레전드 토스터'];
    expect(topKeywords(docs, 1)).toEqual(['dji']);
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
