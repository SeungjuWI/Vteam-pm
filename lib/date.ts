// 한국 표준시(KST = UTC+9, 서머타임 없음) 기준 날짜 유틸.
// Vercel 서버는 UTC로 실행되므로, 출퇴근처럼 "한국 날짜"를 기준으로 하루 경계를
// 잡아야 하는 로직은 반드시 이 함수들을 사용한다. (new Date().setHours(0,0,0,0)는
// 서버에서 UTC 자정 = 한국시간 오전 9시가 되어 날짜 귀속이 어긋난다.)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** date가 속한 한국 날짜의 자정(00:00 KST)을 UTC 시각(Date)으로 반환 */
export function kstStartOfDay(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - KST_OFFSET_MS);
}

/** 오늘(한국) 자정을 UTC 시각으로 반환 */
export function kstStartOfToday(): Date {
  return kstStartOfDay(new Date());
}

/** base가 속한 한국 날짜에서 days일 뒤의 한국 자정을 UTC 시각으로 반환 (KST는 DST 없음) */
export function kstAddDays(base: Date, days: number): Date {
  const d = kstStartOfDay(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** date가 속한 한국 달의 1일 자정(00:00 KST)을 UTC 시각으로 반환 */
export function kstStartOfMonth(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - KST_OFFSET_MS);
}

/** date를 한국 시각 시계로 읽기 위해 +9h 시프트한 Date.
 *  반환값의 getUTCHours()/getUTCMinutes()/getUTCDay()가 각각 한국 시/분/요일을 가리킨다. */
export function toKstParts(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}
