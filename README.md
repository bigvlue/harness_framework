# YouTube 콘텐츠 추천기

YouTube 채널을 분석해 **주요 주제**와 **요즘 바이럴한 유사 콘텐츠**를 찾고, 통계 기반으로
**다음에 만들면 좋을 콘텐츠 5개**를 추천하는 대시보드형 웹 앱입니다. (MVP)

채널 URL만 넣으면:

- 📊 채널 KPI (구독자 / 총 영상 / 최근 평균 조회 / 추천 수)
- 🏆 채널 베스트 영상 (조회수 막대)
- 🔥 최근 30일 바이럴한 유사 콘텐츠
- 🏷 주요 주제 키워드
- 💡 다음 콘텐츠 추천 5개 (확장 기회 ↗ / 강화 추천 ●)

를 한 화면에 보여주고, `report.md`로 다운로드할 수 있습니다.

## 기술 스택

- Next.js 15 (App Router) · TypeScript (strict)
- Tailwind CSS 3 (Wanted Design System 토큰) · Pretendard JP
- YouTube Data API v3 · Vitest

추천은 **순수 통계 기반**입니다(LLM 미사용). 채널 최근 영상 제목·태그에서 키워드를 뽑아,
그 키워드의 최근 바이럴 영상을 조회수순으로 찾고, 반복 키워드를 빈도순으로 정리해 추천합니다.

## 사전 준비

- Node.js 18.18 이상
- YouTube Data API v3 키
  1. [Google Cloud Console](https://console.cloud.google.com/) 접속
  2. 프로젝트 생성 → **APIs & Services → Library**에서 *YouTube Data API v3* 활성화
  3. **Credentials → Create credentials → API key**로 키 발급

## 설치

```bash
npm install
```

루트에 `.env` 파일을 만들고 발급한 키를 넣습니다:

```bash
# .env
YOUTUBE_API_KEY=발급받은_키
```

> ⚠️ **주의:** Next.js는 `.env.local`을 `.env`보다 **우선** 적용합니다.
> 값이 비어 있는 `.env.local`(`YOUTUBE_API_KEY=`)이 있으면 `.env`의 실제 키를 가려서
> "키가 설정되지 않았습니다" 에러가 납니다. 키를 `.env`에 둘 거면 빈 `.env.local`을 두지 마세요.
> (`.env`·`.env.local`은 `.gitignore`에 포함되어 커밋되지 않습니다.)

## 사용

```bash
npm run dev
```

브라우저에서 **http://localhost:3000** 접속 →
입력창에 채널 URL(예: `https://www.youtube.com/@coolmoonchoi`) 입력 → **분석** 클릭.

지원하는 입력 형태:

- 핸들 URL: `https://www.youtube.com/@channelname`
- 채널 ID URL: `https://www.youtube.com/channel/UC...`
- 핸들만: `channelname`

결과 화면 하단의 **⬇ report.md 다운로드**로 분석 리포트를 저장하거나, **🔄 다른 채널 분석**으로 초기화할 수 있습니다.

## 명령어

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버 (build 후)
npm run test    # 단위 테스트 (Vitest)
```

## 동작 방식

1. **채널 해석** — 핸들/ID로 채널 정보(구독자·총 영상·업로드 재생목록) 조회
2. **채널 분석** — 최근 25개 영상의 제목·태그에서 키워드 추출 (상위 8개)
3. **바이럴 탐색** — 상위 키워드 5개로 최근 30일 영상을 조회수순 검색(한국 지역), 자기 채널 영상 제외 후 랭킹
4. **추천 생성** — 바이럴 제목의 반복 키워드를 빈도순으로 정리, 채널이 안 다룬 주제는 "확장 기회", 이미 다루는 주제는 "강화 추천"으로 라벨링

모든 YouTube API 호출은 서버 라우트 핸들러(`app/api/analyze`)에서만 일어나며,
API 키는 클라이언트에 노출되지 않습니다.

## 프로젝트 구조

```
app/
  layout.tsx            # 루트 레이아웃 + Pretendard JP
  page.tsx              # 대시보드 UI (클라이언트)
  api/analyze/route.ts  # 분석 API (서버 전용)
lib/
  analysis.ts           # 순수 함수: 토큰화·키워드·랭킹·추천 (+ 테스트)
  youtube.ts            # YouTube Data API 호출 + analyzeChannel
  report.ts             # 분석 결과 → Markdown (+ 테스트)
types/analysis.ts       # 공용 타입
tailwind.config.ts      # Wanted Design System 토큰
docs/superpowers/       # 설계(spec)·구현 계획(plan) 문서
```

## 알려진 한계

키워드 추출은 의존성 없는 휴리스틱(불용어·조사 절단·숫자 필터)이라, 태그가 없고 제목이
클릭베이트형인 채널에서는 일부 노이즈가 남을 수 있습니다. 의미 수준 정제는 형태소 분석이나
LLM이 필요한 영역으로, 현재 MVP 범위 밖입니다.
