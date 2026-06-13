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
  if (!k) throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다. .env(또는 .env.local)를 확인하세요.');
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
    analyzedAt: now.toISOString(),
  };
}
