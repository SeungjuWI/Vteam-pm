export interface KeyResult {
  id: string;
  title: string;
  progress: number; // 0~100
}

export interface Objective {
  id: string;
  period: string; // 'YYYY-MM'
  title: string;
  description: string | null;
  ownerId: string | null;
  keyResults: KeyResult[];
}

// 목표 진행률 = KR 진행률 평균 (KR 없으면 0)
export function objectiveProgress(o: Objective): number {
  if (o.keyResults.length === 0) return 0;
  const sum = o.keyResults.reduce((acc, kr) => acc + kr.progress, 0);
  return Math.round(sum / o.keyResults.length);
}

// 'YYYY-MM' 포맷
export function formatPeriod(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
