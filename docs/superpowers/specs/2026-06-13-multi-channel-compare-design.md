# 다중 채널 비교 — 설계

작성일: 2026-06-13

## 목적

두 YouTube 채널을 나란히 비교해 KPI(구독자·총 영상·최근 평균 조회)와 주요 주제의
공통점/차이를 한눈에 보여준다. "나 vs 경쟁자" 구도로 포지셔닝을 파악한다.

## 결정 사항 (사용자 합의)

- **채널 수**: 2개 고정.
- **비교 범위**: KPI + 주요 주제(키워드 공통/차이). 베스트·바이럴·추천 비교는 범위 밖.
- **진입**: 별도 비교 페이지 `/compare`. 기존 단일 분석 페이지는 그대로 유지.
- **KPI 표시**: 지표 행 × 채널 열 표, 더 큰 값 강조.

## 아키텍처

기존 패턴 준수: 순수 로직은 `lib/`에서 단위 테스트, YouTube 호출은 서버 라우트에서만,
컴포넌트는 클라이언트. 비교는 **기존 `/api/analyze`를 재사용**해 서버 변경이 없다.

### 파일

- **`lib/compare.ts`** (신규, 순수·테스트 대상)
  - `compareKeywords(a: string[], b: string[]): { common: string[]; onlyA: string[]; onlyB: string[] }`
  - 집합 연산. `common`=a에 있고 b에도 있는 것(a 순서 유지), `onlyA`=a에만, `onlyB`=b에만(b 순서 유지).
  - 키워드는 이미 소문자·중복 제거된 top-N(`topKeywords` 결과)이라 정확 문자열 매칭으로 충분.
- **`app/compare/page.tsx`** (신규, 클라이언트)
  - URL 입력 2개 + "비교" 버튼.
  - 클릭 시 `Promise.allSettled([fetchAnalyze(urlA), fetchAnalyze(urlB)])`로 `/api/analyze`를 2회 병렬 호출(기존 캐시·서버 로직 재사용; 응답의 `report`는 사용하지 않음).
  - 두 `AnalysisResult`로 KPI 표 + `compareKeywords` 결과 3그룹 렌더.
- **`app/page.tsx`** (수정, 소): "여러 채널 비교 →" 링크 추가(`/compare`로 이동). `/compare`에도 "← 단일 채널 분석" 링크.

### 데이터 흐름

```
/compare: URL A, URL B 입력 → "비교"
  → Promise.allSettled([POST /api/analyze {A}, POST /api/analyze {B}])
  → 둘 다 성공? → resultA, resultB
       → KPI 표(지표 행 × 채널 열, 큰 값 강조)
       → compareKeywords(resultA.channelKeywords, resultB.channelKeywords)
          → 공통 / A만 / B만 칩 그룹
  → 하나라도 실패 → 어느 URL이 실패했는지 에러 배너
```

### 비교 뷰 레이아웃

```
📊 {채널 A 제목}  vs  {채널 B 제목}

| 지표          | 채널 A | 채널 B |
| 구독자         | …(큰 값 강조) … |
| 총 영상        | …             |
| 최근 평균 조회   | …             |

🏷 주요 주제
  공통:  [chip] [chip]
  {A}만: [chip] …
  {B}만: [chip] …
```

- KPI: `formatKoreanCount`(구독자·평균조회), `toLocaleString`(총 영상) — 기존 단일 페이지와 동일 포맷. 행별로 더 큰 값을 `font-bold text-primary`로 강조(동률은 강조 없음).
- 주제 칩: 기존 단일 페이지의 키워드 칩 패턴 재사용(클릭 시 유튜브 검색 링크).

## 상태 (4종)

초기(Empty, 안내 문구) / 비교 중(Loading) / 에러(Error, 실패 채널 명시) / 결과(비교 뷰).

## 에러 처리

`Promise.allSettled`로 채널별 결과를 받아, 거부된 쪽의 입력 라벨(채널 A/B + URL)을
넣어 에러 메시지를 구성한다. 둘 다 성공해야 비교 뷰를 렌더한다. 단일 분석과 동일하게
`/api/analyze`가 반환하는 에러 메시지를 그대로 노출한다.

## 테스트 (TDD)

- `lib/compare.test.ts` 먼저 작성 → 통과시키는 구현:
  - 공통/onlyA/onlyB 분류 정확성
  - 교집합 없음(common 빈 배열, onlyA=a, onlyB=b)
  - 완전 일치(common=a, onlyA·onlyB 빈 배열)
  - 한쪽이 빈 배열(common 빈, 다른 쪽 전체가 onlyX)
  - 순서 보존(common·onlyA는 a 순서, onlyB는 b 순서)
- `app/compare/page.tsx`는 UI/네트워크 의존이라 단위 테스트 대상 아님 → `npm run build`(타입) + 수동 확인.

## 스코프 제외 (YAGNI)

비교 리포트(.md) 다운로드, 3개 이상 채널, 베스트/바이럴/추천 비교, 비교 페이지의
강제 새로고침(개별 `/api/analyze` 호출에 이미 캐시·TTL 적용), 채널 자동완성/검증.
