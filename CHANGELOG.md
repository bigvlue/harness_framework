# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

## [0.1.0] - 2026-06-13

첫 MVP. YouTube 채널을 분석해 다음 콘텐츠를 추천하는 대시보드.

### Added
- 채널 분석 대시보드: KPI 타일(구독자/총 영상/최근 평균 조회/추천 수), 채널 베스트 영상,
  최근 30일 바이럴 유사 콘텐츠, 주요 주제 키워드, 다음 콘텐츠 추천 5개(확장/강화 라벨)
- 순수 통계 기반 추천 엔진(LLM 미사용): 키워드 추출 → 바이럴 검색 → 빈도순 추천
- `report.md` 다운로드(분석 결과를 마크다운으로 저장)
- YouTube Data API v3 연동: 모든 호출은 서버 라우트(`app/api/analyze`)에서만 처리해 API 키 비노출
- 한국어 키워드 추출 휴리스틱: 클릭베이트·상거래 불용어, 명사형 조사 절단(은/는/이/가 제외),
  순수 숫자 토큰 제거, 빈도 동순위 시 길이 우선
- Wanted Design System 토큰 + Pretendard JP 기반 UI(라이트 테마)
- 단위 테스트(Vitest, 순수 로직 21개)
- README(설치·사용·동작 방식·한계)

### Notes
- 키는 `.env`의 `YOUTUBE_API_KEY`로 설정. 빈 `.env.local`은 `.env`를 가리므로 두지 말 것.
- 키워드 추출은 휴리스틱이라 태그가 없고 제목이 클릭베이트형인 채널에서는 노이즈가 남을 수 있음
  (의미 수준 정제는 형태소 분석/LLM 영역으로 현재 범위 밖).

[Unreleased]: https://github.com/bigvlue/harness_framework/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bigvlue/harness_framework/releases/tag/v0.1.0
