// 지각 판별 (KST 기준). 출근 시각(clock_in, UTC ISO)을 KST로 읽어 회사 근무설정의
// "출근 마감 시각"과 비교한다. 근무유형별 기준:
//  - fixed   : fixed_start 까지
//  - flexible: flexible_end 까지(유연근무 출근 마감)
//  - free    : 코어타임 사용 시 core_time_start 까지, 아니면 지각 없음
import { toKstParts } from "@/lib/date";

export type LateWorkSettings = {
  work_type?: string | null;
  fixed_start?: string | null;
  flexible_end?: string | null;
  core_time_enabled?: boolean | null;
  core_time_start?: string | null;
} | null | undefined;

/** 지각 기준 시각(KST)을 {h, m}로 반환. 기준이 없으면 null (지각 개념 없음) */
export function lateCutoff(s: LateWorkSettings): { h: number; m: number } | null {
  if (!s) return null;
  let raw: string | null | undefined = null;
  if (s.work_type === "fixed") raw = s.fixed_start;
  else if (s.work_type === "flexible") raw = s.flexible_end;
  else if (s.work_type === "free") raw = s.core_time_enabled ? s.core_time_start : null;
  if (!raw) return null;
  const [h, m] = String(raw).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

/** 출근 시각이 지각인지 (KST 비교) */
export function isLateClockIn(clockInIso: string, s: LateWorkSettings): boolean {
  const cut = lateCutoff(s);
  if (!cut) return false;
  const k = toKstParts(new Date(clockInIso)); // +9h 시프트 → getUTC*가 KST를 가리킴
  const ch = k.getUTCHours();
  const cm = k.getUTCMinutes();
  return ch > cut.h || (ch === cut.h && cm > cut.m);
}
