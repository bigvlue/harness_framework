import { describe, it, expect } from 'vitest';
import { createCache, ANALYSIS_TTL_MS } from './cache';

describe('createCache', () => {
  const TTL = 1000; // 1초

  it('set 직후 get은 값을 반환한다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', 0)).toBe(42);
  });

  it('TTL 만료 직전(now = 저장시각 + ttl - 1)은 히트', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', TTL - 1)).toBe(42);
  });

  it('TTL 경계(now = 저장시각 + ttl)와 그 이후는 미스(undefined)', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 42, 0);
    expect(cache.get('a', TTL)).toBeUndefined();
    expect(cache.get('a', TTL + 5000)).toBeUndefined();
  });

  it('없는 키는 undefined', () => {
    const cache = createCache<number>(TTL);
    expect(cache.get('missing', 0)).toBeUndefined();
  });

  it('키는 서로 격리된다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    expect(cache.get('a', 0)).toBe(1);
    expect(cache.get('b', 0)).toBe(2);
  });

  it('같은 키 재 set은 값과 저장시각을 갱신한다', () => {
    const cache = createCache<number>(TTL);
    cache.set('a', 1, 0);
    cache.set('a', 2, 500); // 갱신: 새 저장시각 500
    expect(cache.get('a', 500)).toBe(2);
    expect(cache.get('a', 1499)).toBe(2);
    expect(cache.get('a', 1500)).toBeUndefined();
  });

  it('ANALYSIS_TTL_MS는 6시간', () => {
    expect(ANALYSIS_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });
});
