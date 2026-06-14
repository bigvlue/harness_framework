import type { VideoStat, Recommendation } from '@/types/analysis';

export type ChannelRef = { type: 'id'; value: string } | { type: 'handle'; value: string };

const STOPWORDS = new Set([
  // 영어
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'this', 'that', 'how', 'what', 'you', 'your', 'my',
  'when', 'where', 'why', 'which', 'who', 'will', 'would', 'should',
  'can', 'could', 'do', 'does', 'did', 'vs', 'get', 'got',
  // 한국어 빈출
  '그리고', '하는', '하기', '이것', '저것', '정말', '진짜', '너무', '오늘',
  '우리', '내가', '나의', '영상', '구독', '좋아요', '채널',
  // 클릭베이트·상거래 상투어 (제목에서 주제어를 가리는 노이즈)
  '이번주', '이번', '모음', '무조건', '신제품', '제품', '가지', '느낌', '등장',
  '미친', '완전', '역대급', '드디어', '그냥', '이건', '가격', '구매', '추천',
  '리뷰', '같은', '대박', '최고', '최신', '공개', '출시', '사야할', '사고싶은',
  '갖고싶음', '직접', '과연', '결국', '처음', '이거', '그거', '저거', '요즘',
  '여기', '거기', '정도', '진심', '이게', '그게', '저게', '근데', '이런', '그런', '저런',
]);

// 명사 뒤에 붙어 같은 주제어를 다른 토큰으로 갈라놓는 조사들.
// 동사/형용사 어미(는/은) 및 명사 끝글자와 자주 겹치는 이/가는 의도적으로 제외해 오절단(고양이→고양)을 막는다.
// 긴 것부터 매칭한다.
const PARTICLES = ['에서', '으로', '까지', '들', '을', '를', '의', '로'];

function stripParticle(token: string): string {
  for (const p of PARTICLES) {
    if (token.endsWith(p) && token.length - p.length >= 2) {
      return token.slice(0, token.length - p.length);
    }
  }
  return token;
}

// 사-한자 숫자어. 이런 글자로만 이뤄진 3글자 이상 토큰은 숫자 나열(예: '일십백천만')이라 주제어가 아니다.
// 길이 3 이상으로 제한해 '사육'·'오만' 같은 2글자 실단어 오제거를 막는다.
const NUMBER_WORDS = new Set('영공일이삼사오육칠팔구십백천만억조');

function isNumberWordRun(token: string): boolean {
  return token.length >= 3 && [...token].every((c) => NUMBER_WORDS.has(c));
}

export function parseChannelInput(input: string): ChannelRef {
  const s = input.trim();
  const channelMatch = s.match(/\/channel\/(UC[\w-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  if (/^UC[\w-]{20,}$/.test(s)) return { type: 'id', value: s };
  const handleMatch = s.match(/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  return { type: 'handle', value: s.replace(/^\/+|\/+$/g, '') };
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+|[가-힣]+/g) ?? [];
  return raw
    .map((t) => (/[가-힣]/.test(t) ? stripParticle(t) : t))
    .filter(
      (t) =>
        t.length >= 2 &&
        !STOPWORDS.has(t) &&
        !/^\d+$/.test(t) && // 순수 숫자
        !isNumberWordRun(t) && // 한글 숫자어 나열
        !t.endsWith('니다'), // 활용 서술어(습니다/입니다/…)
    );
}

// documents: 영상 1개 = 문서 1개(제목+태그를 합친 문자열).
// 클릭베이트 채널에선 한 영상에서만 반복되는 잡음 단어가 TF로는 높게 잡히므로,
// "몇 개의 영상에 걸쳐 등장했는가"(문서 빈도, DF)를 1순위로 본다.
// DF 동률이면 전체 출현 빈도(TF), 그다음 길이(구체성) 순.
//
// 단일어(unigram)와 함께 인접 토큰 2어절 구문(bigram)도 후보로 둔다.
// "로봇 청소기"처럼 여러 영상에 반복되는 구문은 단일어보다 구체적인 주제 신호다.
// 단, 1회성 bigram은 노이즈라 DF≥2인 것만 채택한다.
export function topKeywords(documents: string[], n: number): string[] {
  const df = new Map<string, number>(); // 문서(영상) 빈도
  const tf = new Map<string, number>(); // 전체 출현 빈도
  const bigrams = new Set<string>(); // 어떤 term이 bigram인지 표시

  for (const doc of documents) {
    const toks = tokenize(doc);
    const seen = new Set<string>();
    const tally = (term: string, isBigram: boolean) => {
      tf.set(term, (tf.get(term) ?? 0) + 1);
      if (!seen.has(term)) {
        df.set(term, (df.get(term) ?? 0) + 1);
        seen.add(term);
      }
      if (isBigram) bigrams.add(term);
    };
    for (let i = 0; i < toks.length; i++) {
      tally(toks[i], false);
      if (i + 1 < toks.length) tally(`${toks[i]} ${toks[i + 1]}`, true);
    }
  }

  const ranked = [...df.keys()]
    .filter((t) => !bigrams.has(t) || df.get(t)! >= 2) // bigram은 DF≥2만
    .sort(
      (a, b) =>
        df.get(b)! - df.get(a)! || // 여러 영상에 걸친 주제 우선
        tf.get(b)! - tf.get(a)! || // 동률이면 전체 빈도
        b.length - a.length, // 그다음 길이(구체성) → 구문이 단일어보다 우선
    );

  // 중복 억제: 채택한 bigram의 구성 단일어는 결과에서 제외한다.
  const result: string[] = [];
  const covered = new Set<string>();
  for (const term of ranked) {
    if (result.length >= n) break;
    if (covered.has(term)) continue;
    result.push(term);
    if (bigrams.has(term)) for (const part of term.split(' ')) covered.add(part);
  }
  return result;
}

export function scoreVideo(viewCount: number, publishedAt: string, now: Date): number {
  const ageDays = Math.max(1, (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000);
  return viewCount + viewCount / ageDays;
}

export function rankVideos(videos: VideoStat[], now: Date, limit: number): VideoStat[] {
  return [...videos]
    .sort(
      (a, b) =>
        scoreVideo(b.viewCount, b.publishedAt, now) -
        scoreVideo(a.viewCount, a.publishedAt, now),
    )
    .slice(0, limit);
}

export function extractRecommendations(
  viralVideos: VideoStat[],
  channelKeywords: string[],
  n: number,
): Recommendation[] {
  // 채널 키워드가 bigram("로봇 청소기")이어도 바이럴 제목의 단일어 토큰과 매칭되도록
  // 구성 단어로 분해해 커버리지 집합을 만든다.
  const channelSet = new Set(channelKeywords.flatMap((k) => k.split(' ')));
  const counts = new Map<string, { count: number; top: VideoStat }>();
  for (const v of viralVideos) {
    for (const tok of tokenize(v.title)) {
      const entry = counts.get(tok);
      if (entry) entry.count += 1;
      else counts.set(tok, { count: 1, top: v });
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count; // 빈도 높은 순
      const aGap = channelSet.has(a[0]) ? 0 : 1;
      const bGap = channelSet.has(b[0]) ? 0 : 1;
      return bGap - aGap; // 빈도 동일 시 gap(미커버) 우선
    })
    .slice(0, n);

  return ranked.map(([word, { top }]) => {
    const expansion = !channelSet.has(word);
    return {
      topic: `"${word}" 주제 콘텐츠`,
      rationale: `바이럴 영상 「${top.title}」 (${top.viewCount.toLocaleString()}회)에서 자주 등장한 키워드`,
      fit: expansion ? '채널이 아직 안 다룬 주제 — 확장 기회' : '채널이 이미 다루는 주제 — 강화 추천',
      expansion,
    };
  });
}

export function formatKoreanCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}
