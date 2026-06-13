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
