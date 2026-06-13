import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time';

// 기준 시각 고정: 2026-06-14T12:00:00Z
const now = new Date('2026-06-14T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('formatRelativeTime', () => {
  it('60초 미만은 "방금 전"', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('방금 전');
    expect(formatRelativeTime(ago(30_000), now)).toBe('방금 전');
    expect(formatRelativeTime(ago(59_000), now)).toBe('방금 전');
  });

  it('분 단위', () => {
    expect(formatRelativeTime(ago(60_000), now)).toBe('1분 전');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5분 전');
    expect(formatRelativeTime(ago(59 * 60_000), now)).toBe('59분 전');
  });

  it('시간 단위', () => {
    expect(formatRelativeTime(ago(60 * 60_000), now)).toBe('1시간 전');
    expect(formatRelativeTime(ago(23 * 60 * 60_000), now)).toBe('23시간 전');
  });

  it('일 단위', () => {
    expect(formatRelativeTime(ago(24 * 60 * 60_000), now)).toBe('1일 전');
    expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000), now)).toBe('3일 전');
  });

  it('미래 시각은 "방금 전"', () => {
    expect(formatRelativeTime(ago(-10_000), now)).toBe('방금 전');
  });
});
