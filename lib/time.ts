/**
 * ISO 시각과 기준 시각(now)의 차이를 한국어 상대 시간으로 포맷한다.
 * 음수(미래) 차이는 "방금 전"으로 처리한다.
 */
export function formatRelativeTime(fromIso: string, now: Date): string {
  const sec = Math.floor((now.getTime() - new Date(fromIso).getTime()) / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
