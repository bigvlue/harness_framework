'use client';

import { useState } from 'react';
import type { AnalysisResult, VideoStat } from '@/types/analysis';
import { formatKoreanCount } from '@/lib/analysis';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-frame bg-bg-alt p-4 shadow-sm">
      <p className="text-[15px] text-label-alt">{label}</p>
      <p className="mt-1 text-[32px] font-bold leading-tight text-label-normal">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-frame border border-line-normal bg-bg-normal p-5 shadow-sm">
      <h2 className="mb-3 text-[20px] font-semibold text-label-normal">{title}</h2>
      {children}
    </div>
  );
}

function VideoBars({ videos, barClass }: { videos: VideoStat[]; barClass: string }) {
  const max = Math.max(1, ...videos.map((v) => v.viewCount));
  return (
    <ul className="space-y-2">
      {videos.map((v) => (
        <li key={v.videoId}>
          <a
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[15px] text-label-normal hover:text-primary"
          >
            {v.title}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill-normal">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{ width: `${Math.max(4, (v.viewCount / max) * 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[13px] text-label-alt">
              {formatKoreanCount(v.viewCount)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [url, setUrl] = useState('https://www.youtube.com/@coolmoonchoi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [report, setReport] = useState('');

  async function analyze(refresh = false) {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: url, refresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석에 실패했습니다.');
      setResult(data.result);
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const blob = new Blob([report], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report.md';
    a.click();
    // Firefox는 click() 후 비동기로 다운로드를 시작하므로 즉시 revoke하면 실패할 수 있음
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="mb-6 text-[28px] font-bold text-label-normal">
        🎬 YouTube 콘텐츠 추천기
      </h1>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="채널 URL"
          placeholder="채널 URL (예: https://www.youtube.com/@coolmoonchoi)"
        />
        <button
          className="rounded-frame bg-primary px-6 py-3 text-[16px] font-medium text-white hover:bg-primary-strong active:bg-primary-heavy disabled:opacity-50"
          onClick={() => analyze()}
          disabled={loading || url.trim() === ''}
        >
          {loading ? '분석 중…' : '분석'}
        </button>
      </div>

      {!result && !error && !loading && (
        <p className="mt-6 text-[15px] text-label-alt">채널 주소를 넣고 분석을 눌러보세요.</p>
      )}
      {loading && (
        <p className="mt-6 text-[15px] text-label-alt">⏳ 채널을 분석하고 있어요 (보통 3~8초)…</p>
      )}
      {error && (
        <p className="mt-6 rounded-frame border border-line-normal bg-bg-alt p-4 text-[15px] text-status-negative">
          ⚠ {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <h2 className="text-[24px] font-bold text-label-normal">
            📊 {result.channelTitle} — 콘텐츠 대시보드
          </h2>

          {/* KPI 타일 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi label="구독자" value={formatKoreanCount(result.channelStats.subscriberCount)} />
            <Kpi label="총 영상" value={result.channelStats.videoCount.toLocaleString()} />
            <Kpi label="최근 평균 조회" value={formatKoreanCount(result.channelStats.avgRecentViews)} />
            <Kpi label="추천" value={`${result.recommendations.length}건`} />
          </div>

          {/* 2×2 패널 격자 */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Panel title="🏆 채널 베스트 영상">
              <VideoBars videos={result.channelBest} barClass="bg-accent-cyan" />
            </Panel>

            <Panel title="🔥 요즘 바이럴한 유사 콘텐츠">
              <VideoBars videos={result.viralVideos} barClass="bg-accent-redorange" />
            </Panel>

            <Panel title="🏷 주요 주제">
              <div className="flex flex-wrap gap-2">
                {result.channelKeywords.map((k) => (
                  <a
                    key={k}
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(k)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-frame bg-fill-normal px-3 py-1 text-[15px] text-label-neutral hover:text-primary"
                  >
                    {k}
                  </a>
                ))}
              </div>
            </Panel>

            <Panel title="💡 다음 콘텐츠 추천">
              <ol className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="rounded-frame bg-bg-alt p-3">
                    <p className="text-[16px] font-medium text-label-normal">
                      {i + 1}. {rec.topic}
                    </p>
                    <p className="mt-1 text-[15px] text-label-alt">근거: {rec.rationale}</p>
                    <p className="mt-1 text-[15px]">
                      <span
                        className={
                          rec.expansion ? 'text-primary' : 'text-status-positive'
                        }
                      >
                        {rec.expansion ? '↗ 확장 기회' : '● 강화 추천'}
                      </span>
                      <span className="text-label-alt"> — {rec.fit}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          {/* 하단 액션 */}
          <div className="flex gap-3">
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt disabled:opacity-50"
              onClick={() => analyze(true)}
              disabled={loading || url.trim() === ''}
            >
              ♻ 강제 재분석
            </button>
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={download}
            >
              ⬇ report.md 다운로드
            </button>
            <button
              className="rounded-frame border border-line-normal bg-bg-normal px-5 py-3 text-[16px] font-medium text-label-normal hover:bg-bg-alt"
              onClick={() => {
                setResult(null);
                setReport('');
                setError('');
              }}
            >
              🔄 다른 채널 분석
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
