export interface Cache<T> {
  get(key: string, now: number): T | undefined;
  set(key: string, value: T, now: number): void;
}

/**
 * 인메모리 TTL 캐시. 시간은 `now`(밀리초)를 인자로 받아 주입하므로
 * 실제 타이머 없이 만료를 단위 테스트할 수 있다.
 * 저장 시각 + ttlMs <= now 이면 만료(미스).
 */
export function createCache<T>(ttlMs: number): Cache<T> {
  const store = new Map<string, { value: T; storedAt: number }>();
  return {
    get(key, now) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.storedAt + ttlMs <= now) return undefined;
      return entry.value;
    },
    set(key, value, now) {
      store.set(key, { value, storedAt: now });
    },
  };
}

/** 분석 결과 캐시 TTL: 6시간 */
export const ANALYSIS_TTL_MS = 6 * 60 * 60 * 1000;
