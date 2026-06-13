import { describe, it, expect } from 'vitest';
import { compareKeywords } from './compare';

describe('compareKeywords', () => {
  it('공통/onlyA/onlyB로 분류한다', () => {
    expect(compareKeywords(['vlog', 'cafe', 'travel'], ['cafe', 'travel', 'cooking'])).toEqual({
      common: ['cafe', 'travel'],
      onlyA: ['vlog'],
      onlyB: ['cooking'],
    });
  });

  it('교집합이 없으면 common은 빈 배열', () => {
    expect(compareKeywords(['a', 'b'], ['c', 'd'])).toEqual({
      common: [],
      onlyA: ['a', 'b'],
      onlyB: ['c', 'd'],
    });
  });

  it('완전히 같으면 onlyA·onlyB는 빈 배열', () => {
    expect(compareKeywords(['a', 'b'], ['a', 'b'])).toEqual({
      common: ['a', 'b'],
      onlyA: [],
      onlyB: [],
    });
  });

  it('한쪽이 빈 배열', () => {
    expect(compareKeywords([], ['a', 'b'])).toEqual({ common: [], onlyA: [], onlyB: ['a', 'b'] });
    expect(compareKeywords(['a', 'b'], [])).toEqual({ common: [], onlyA: ['a', 'b'], onlyB: [] });
  });

  it('양쪽 모두 빈 배열', () => {
    expect(compareKeywords([], [])).toEqual({ common: [], onlyA: [], onlyB: [] });
  });

  it('순서 보존: common·onlyA는 a 순서, onlyB는 b 순서', () => {
    const r = compareKeywords(['z', 'm', 'a'], ['a', 'z', 'q']);
    expect(r.common).toEqual(['z', 'a']); // a의 순서 유지
    expect(r.onlyA).toEqual(['m']);
    expect(r.onlyB).toEqual(['q']); // b의 순서 유지
  });
});
