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
    const { channelUrl } = await req.json();
    if (!channelUrl || typeof channelUrl !== 'string') {
      return NextResponse.json({ error: '채널 URL을 입력하세요.' }, { status: 400 });
    }

    const ref = parseChannelInput(channelUrl);
    const key = `${ref.type}:${ref.value}`;
    const now = Date.now();

    let result = cache.get(key, now);
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
