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
