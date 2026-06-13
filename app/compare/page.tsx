'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalysisResult } from '@/types/analysis';
import { formatKoreanCount } from '@/lib/analysis';
import { compareKeywords } from '@/lib/compare';

async function fetchAnalyze(channelUrl: string): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '분석에 실패했습니다.');
  return data.result;
}

function KpiRow({
  label,
  a,
  b,
  raw,
}: {
  label: string;
  a: string;
  b: string;
  raw: [number, number];
}) {
  const aWins = raw[0] > raw[1];
  const bWins = raw[1] > raw[0];
  return (
    <tr className="border-b border-line-normal">
      <td className="py-2 pr-4 text-[15px] text-label-alt">{label}</td>
      <td className={`py-2 text-right text-[16px] ${aWins ? 'font-bold text-primary' : 'text-label-normal'}`}>
        {a}
      </td>
      <td className={`py-2 text-right text-[16px] ${bWins ? 'font-bold text-primary' : 'text-label-normal'}`}>
        {b}
      </td>
    </tr>
  );
}

function KeywordChips({ words }: { words: string[] }) {
  if (words.length === 0) return <span className="text-[15px] text-label-alt">없음</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {words.map((k) => (
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
  );
}

export default function Compare() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pair, setPair] = useState<{ a: AnalysisResult; b: AnalysisResult } | null>(null);

  async function compare() {
    setLoading(true);
    setError('');
    setPair(null);
    try {
      const [ra, rb] = await Promise.allSettled([
        fetchAnalyze(urlA.trim()),
        fetchAnalyze(urlB.trim()),
      ]);
      if (ra.status === 'rejected' || rb.status === 'rejected') {
        const parts: string[] = [];
        if (ra.status === 'rejected')
          parts.push(`채널 A(${urlA}): ${ra.reason instanceof Error ? ra.reason.message : '실패'}`);
        if (rb.status === 'rejected')
          parts.push(`채널 B(${urlB}): ${rb.reason instanceof Error ? rb.reason.message : '실패'}`);
        setError(parts.join(' / '));
        return;
      }
      setPair({ a: ra.value, b: rb.value });
    } finally {
      setLoading(false);
    }
  }

  const kw = pair ? compareKeywords(pair.a.channelKeywords, pair.b.channelKeywords) : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-label-normal">⚖️ 채널 비교</h1>
        <Link href="/" className="text-[15px] text-primary hover:underline">
          ← 단일 채널 분석
        </Link>
      </div>

      <div className="space-y-3">
        <input
          className="w-full rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={urlA}
          onChange={(e) => setUrlA(e.target.value)}
          aria-label="채널 A URL"
          placeholder="채널 A URL"
        />
        <input
          className="w-full rounded-frame border border-line-normal bg-bg-normal px-4 py-3 text-[16px] text-label-normal outline-none focus:border-primary"
          value={urlB}
          onChange={(e) => setUrlB(e.target.value)}
          aria-label="채널 B URL"
          placeholder="채널 B URL"
        />
        <button
          className="rounded-frame bg-primary px-6 py-3 text-[16px] font-medium text-white hover:bg-primary-strong active:bg-primary-heavy disabled:opacity-50"
          onClick={compare}
          disabled={loading || urlA.trim() === '' || urlB.trim() === ''}
        >
          {loading ? '비교 중…' : '비교'}
        </button>
      </div>

      {!pair && !error && !loading && (
        <p className="mt-6 text-[15px] text-label-alt">두 채널 주소를 넣고 비교를 눌러보세요.</p>
      )}
      {loading && <p className="mt-6 text-[15px] text-label-alt">⏳ 두 채널을 분석하고 있어요…</p>}
      {error && (
        <p className="mt-6 rounded-frame border border-line-normal bg-bg-alt p-4 text-[15px] text-status-negative">
          ⚠ {error}
        </p>
      )}

      {pair && kw && (
        <div className="mt-8 space-y-6">
          <h2 className="text-[24px] font-bold text-label-normal">
            📊 {pair.a.channelTitle} vs {pair.b.channelTitle}
          </h2>

          <table className="w-full">
            <thead>
              <tr className="border-b border-line-normal">
                <th className="py-2 text-left text-[15px] text-label-alt">지표</th>
                <th className="py-2 text-right text-[15px] text-label-alt">{pair.a.channelTitle}</th>
                <th className="py-2 text-right text-[15px] text-label-alt">{pair.b.channelTitle}</th>
              </tr>
            </thead>
            <tbody>
              <KpiRow
                label="구독자"
                a={formatKoreanCount(pair.a.channelStats.subscriberCount)}
                b={formatKoreanCount(pair.b.channelStats.subscriberCount)}
                raw={[pair.a.channelStats.subscriberCount, pair.b.channelStats.subscriberCount]}
              />
              <KpiRow
                label="총 영상"
                a={pair.a.channelStats.videoCount.toLocaleString()}
                b={pair.b.channelStats.videoCount.toLocaleString()}
                raw={[pair.a.channelStats.videoCount, pair.b.channelStats.videoCount]}
              />
              <KpiRow
                label="최근 평균 조회"
                a={formatKoreanCount(pair.a.channelStats.avgRecentViews)}
                b={formatKoreanCount(pair.b.channelStats.avgRecentViews)}
                raw={[pair.a.channelStats.avgRecentViews, pair.b.channelStats.avgRecentViews]}
              />
            </tbody>
          </table>

          <div className="space-y-4">
            <h3 className="text-[20px] font-semibold text-label-normal">🏷 주요 주제</h3>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">공통</p>
              <KeywordChips words={kw.common} />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">{pair.a.channelTitle}만</p>
              <KeywordChips words={kw.onlyA} />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-medium text-label-normal">{pair.b.channelTitle}만</p>
              <KeywordChips words={kw.onlyB} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
