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
  analyzedAt: string; // 분석 수행 시각 (ISO 8601). 캐시 히트 시 원래 분석 시각 유지.
}
