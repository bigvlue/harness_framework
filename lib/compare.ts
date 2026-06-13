export interface KeywordComparison {
  common: string[]; // a·b 모두에 있는 키워드 (a의 순서)
  onlyA: string[]; // a에만 있는 키워드 (a의 순서)
  onlyB: string[]; // b에만 있는 키워드 (b의 순서)
}

/**
 * 두 채널의 키워드 목록을 공통/각자 전용으로 분류한다.
 * 키워드는 이미 소문자·중복 제거된 top-N(topKeywords 결과)이라 정확 문자열 매칭으로 비교한다.
 */
export function compareKeywords(a: string[], b: string[]): KeywordComparison {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    common: a.filter((k) => setB.has(k)),
    onlyA: a.filter((k) => !setB.has(k)),
    onlyB: b.filter((k) => !setA.has(k)),
  };
}
