import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'YouTube 콘텐츠 추천기',
  description: '채널 분석 + 다음 콘텐츠 추천',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard JP (CDN). 차단 시 system-ui 폴백 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard-jp/dist/web/static/pretendard-jp.css"
        />
      </head>
      <body className="bg-bg-normal font-sans text-label-normal antialiased">
        {children}
      </body>
    </html>
  );
}
