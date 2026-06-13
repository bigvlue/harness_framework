# YouTube 채널 분석 & 다음 콘텐츠 추천기 — 설계 (MVP)

작성일: 2026-06-13

## 목적

특정 YouTube 채널(첫 대상: `https://www.youtube.com/@coolmoonchoi`)을 분석해
어떤 콘텐츠를 하고 있는지 파악하고, 같은 분야에서 요즘 바이럴한 콘텐츠를 찾아
**다음에 만들면 좋을 콘텐츠 5개**를 추천한 뒤 그 분석을 **대시보드**로 보여준다.

프로토타입/MVP. 단순함이 최우선.

## 페르소나 (단일 사용자)

채널 기획자 / 운영자. 비개발자도 가능(URL 붙여넣기만). 아이디어 회의 전 5분 안에
"다음 영상 뭘 만들지"를 감이 아니라 데이터로 정하고, 근거 있는 추천 5개를
`report.md`로 회의에 가져가는 것이 성공 기준. 로그인·히스토리·다중 사용자 없음.

## 유저 저니 (5단계)

```
 0. 진입      1. URL 입력    2. 분석 대기     3. 결과 해석    4. 활용
 빈 화면 +  → 채널 주소    → ⏳ 3~8초     → 대시보드     → report.md
 안내문구     붙여넣기       (서버가 일함)    4개 영역 읽기   다운로드/재분석
```

| 단계 | 유저 행동 | 보이는 것 | 뒤에서 일어나는 일 |
|------|-----------|-----------|---------------------|
| 0 진입 | 페이지 열기 | 제목 + 입력창(샘플 URL) + "분석" 버튼 | 없음(정적) |
| 1 입력 | 채널 URL 붙여넣기 | 입력창 텍스트 | 없음 |
| 2 대기 | "분석" 클릭 | 버튼 "분석 중…", 로딩 문구 | `/api/analyze`가 YouTube API 호출 + 계산 |
| 3 해석 | 대시보드 읽기 | KPI 타일 + 4개 패널 | 없음(받은 JSON 렌더) |
| 4 활용 | 다운로드/재분석 | 파일 저장 / 화면 초기화 | Blob 생성 또는 새 요청 |

## 유저 플로우 (분기)

```
시작 → [채널 URL 입력] ──빈값──► 버튼 비활성 / "URL 넣으세요"
            │ 유효
            ▼
        [ "분석" 클릭 ] → POST /api/analyze → 서버 처리
            │
       성공 ▼                         실패 ▼ (키없음/채널없음/쿼터)
   [대시보드 렌더]                  [에러 배너 + 재시도]
       │
       ├─► [report.md 다운로드] (끝)
       └─► [다른 채널 분석] → 입력칸으로 복귀
```

핵심 분기는 둘뿐: 성공/실패, 그리고 결과 후 다운로드/재분석. 단일 경로.

## 아키텍처

- Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS 3
- 프로젝트 CLAUDE.md의 CRITICAL 규칙 준수:
  - 모든 YouTube API 호출은 **서버 라우트 핸들러**에서만 → API 키 비노출
  - 클라이언트 컴포넌트에서 외부 API 직접 호출 금지
  - 컴포넌트는 `components/`, 타입은 `types/`에 분리

### 데이터 흐름 (시퀀스)

```
브라우저            /api/analyze(서버)          YouTube Data API v3
   │ POST channelUrl  │                              │
   │ ────────────────►│ ① channels?forHandle ──────►│ 채널명·구독자·총영상·업로드재생목록
   │                  │ ② playlistItems ───────────►│ 최근 25개 영상 ID
   │                  │ ③ videos?stats(25) ────────►│ 제목·태그·조회수
   │                  │ ★ 순수로직: 키워드 top8 + avg │
   │                  │ ④ search ×5 (viewCount) ───►│ 바이럴 후보 ID
   │                  │ ⑤ videos?stats(≤50) ───────►│ 후보 조회수
   │                  │ ★ 순수로직: 랭킹 + 추천 5     │
   │ {result, report} │                              │
   │◄─────────────────│                              │
   │ 대시보드 렌더 + 다운로드                          │
```

★ 두 단계가 네트워크 없는 순수 계산 → 단위 테스트 대상. 나머지(①~⑤)는 얇은 fetch 래퍼.

### 파일 구조

```
app/
  layout.tsx                # 루트 레이아웃 + Pretendard JP 폰트 + 배경색
  page.tsx                  # 입력창 + 대시보드 (클라이언트, 4상태)
  api/analyze/route.ts      # 분석 API (서버, YouTube 호출 전담)
  globals.css               # tailwind 지시문
lib/
  analysis.ts               # 순수 함수: 파싱/토큰화/키워드/랭킹/추천/숫자포맷
  analysis.test.ts          # analysis 단위 테스트
  youtube.ts                # YouTube API 호출 + analyzeChannel 오케스트레이션
  report.ts                 # AnalysisResult → Markdown
  report.test.ts            # report 단위 테스트
types/
  analysis.ts               # 공용 타입
tailwind.config.ts          # Wanted 디자인 토큰 등록
.env.local / .env.example   # YOUTUBE_API_KEY
```

## 핵심 알고리즘 (순수 통계 기반, 추가 API 키 없음)

### (a) 채널 분석
1. 채널 핸들/ID 해석 (`channels?part=snippet,contentDetails,statistics&forHandle=`)
   → 채널명, 구독자 수, 총 영상 수, 업로드 재생목록 ID
2. 업로드 재생목록에서 최근 ~25개 영상 ID (`playlistItems`)
3. 영상 통계·태그·제목 수집 (`videos?part=snippet,statistics`)
4. 제목 + 태그 토큰화 → 키워드 추출 휴리스틱 → 상위 주제 키워드 top 8
   - 강화된 불용어(클릭베이트·상거래 상투어: 이번주/모음/무조건/사고싶은/제품 등) 제거
   - 명사형 조사 절단(들/을/를/의/에서/으로/까지 → 변형 병합). 동사어미·명사 끝글자와 겹치는 은/는/이/가는 오절단 방지 위해 제외
   - 순수 숫자 토큰 제거(검색 노이즈 방지; 모델명의 영숫자는 유지)
   - 동순위 시 더 긴(구체적) 토큰 우선
   - 클릭베이트 채널은 제목에 주제어가 어절로 붙어(예: "굿즈사야겠다") 일부 노이즈가 남을 수 있음 — 의미 수준 정제는 LLM 영역(현 스코프 밖)
5. 채널 자체 조회수 상위 5 + 최근 25개 평균 조회수 계산

### (b) 바이럴 유사 콘텐츠 탐색
- 상위 키워드 5개 각각:
  `search?type=video&order=viewCount&publishedAfter=<최근30일>&regionCode=KR&relevanceLanguage=ko&maxResults=10`
- 후보 통계 수집(최대 50개), 분석 대상 채널 자기 영상 제외
- 랭킹 점수 = 조회수 + 일평균 조회수(조회수 / 게시 후 경과일)
- 상위 10개를 "요즘 바이럴"로 확정

### (c) 다음 콘텐츠 추천 (5개 고정)
- 바이럴 상위 제목에서 반복 키워드 추출 → **빈도순 정렬**(동순위면 채널이 안 다룬 주제 gap 우선)
- 각 추천에 `expansion` 라벨: 채널이 안 다룬 키워드면 "확장 기회 ↗", 이미 다루면 "강화 추천 ●"
- 추천 5개, 각 항목: 제안 주제 / 근거(바이럴 영상 + 조회수) / 적합성(확장·강화)

LLM 없이 빈도·조회수·gap 기반 → 설명 가능하고 단순.

## 출력: 대시보드 + report.md

### 대시보드 (결과 화면, 단일 페이지)
- **상단 KPI 타일 4개**: 구독자 / 총 영상 / 최근 25개 평균 조회 / 추천 건수
- **2×2 패널 격자**:
  - 🏆 채널 베스트 5 (조회수 막대)
  - 🔥 요즘 바이럴 (조회수 막대)
  - 🏷 주요 주제 (키워드 칩, 클릭 시 유튜브 검색)
  - 💡 다음 콘텐츠 추천 5 (확장/강화 뱃지)
- 하단: `report.md 다운로드` / `다른 채널 분석`
- 막대는 차트 라이브러리 없이 div 너비 비율 (조회수/패널최댓값)

### 화면 상태 4종
초기(Empty) / 분석 중(Loading) / 결과(Dashboard) / 에러(Error).

### report.md 다운로드
대시보드 내용을 마크다운으로 정리(맨 위 KPI 요약 줄 포함). 서버에서 문자열 생성 → 클라이언트 Blob 다운로드.

## 디자인 시스템 (Wanted Design System Community)

라이트 테마 전용(토큰에 라이트값만 존재). 토큰은 `tailwind.config.ts`에 등록해 시맨틱 클래스로 사용.

```
색상
  Primary 액션      #0066FF (hover #005EEB / active #0054D1)
  본문 텍스트        #171719 (Label/Normal)
  보조 텍스트        #37383C9C (Label/Alternative)
  페이지 배경        #FFFFFF (Background/Normal)
  타일·패널 배경     #F7F7F8 (Background/Alternative)
  카드 테두리        #E1E2E4 (Line/Solid/Normal)
  키워드 칩 배경     #70737C14 (Fill/Normal)
  에러               #FF4242 (Status/Negative)
  막대·강조          Accent 팔레트(RedOrange #FF5E00 / Cyan #00BDDE / Violet #6541F2 …)
타이포 (Pretendard JP, CDN)
  대시보드 제목  Title 2/Bold 28 · KPI 숫자 Title 1/Bold 32
  패널 헤딩      Heading 2/Bold 20 · 본문 Body1 16 · 캡션 Body2 15
형태
  라운드 14px (Frame/Radius) · 그림자 Shadow/Normal/Small
  격자 gutter 20px / gap 16px · Desktop 12 → Tablet 3 → Mobile 2col
```

## 환경 변수

- `.env`: `YOUTUBE_API_KEY=<YouTube Data API v3 키>` (커밋 금지) — 실제 사용 위치
- `.env.example`: 양식 안내
- `.gitignore`에 `.env`·`.env.local` 추가
- ⚠ 함정: Next.js는 `.env.local`이 `.env`보다 **우선**한다. 빈 값(`YOUTUBE_API_KEY=`)이 든 `.env.local`이 있으면 `.env`의 실제 키를 가려서 키 누락 에러가 난다. 키를 `.env`에 둘 거면 빈 `.env.local`을 두지 말 것.

## 에러 처리 (MVP 최소)

- 키 누락 / 채널 못 찾음 / YouTube API 에러(쿼터 등): API 라우트가 메시지 반환 → 에러 배너 표시.

## 스코프 제외 (YAGNI)

DB, 로그인, 캐싱, 다중 채널 동시 분석, LLM 추천, 다크 테마, 차트 라이브러리, 배포 설정.
단위 테스트는 `lib/analysis.ts`·`lib/report.ts` 순수 함수에 한정.

## 알아둘 점

- YouTube `search`는 쿼터 100유닛/회(기본 일 10,000). 키워드 5개면 1회 분석 ≈ 500유닛 → 하루 ~20회. 프로토타입에 충분.
- 첫 대상은 한국어 채널 추정 → `regionCode=KR`, `relevanceLanguage=ko` 기본값. URL 입력이라 다른 채널도 분석 가능.
- Pretendard JP는 CDN 로드. 차단 시 system-ui로 폴백.
