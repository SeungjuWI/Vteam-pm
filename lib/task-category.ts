// 업무 제목/설명에서 업무 "종류"를 자동 추정하는 키워드 태깅.
// 완벽한 분류가 목적이 아니라 대략적 성격 파악용. 우선순위 순으로 첫 매칭을 반환한다.

export type TaskCategory =
  | "개발/배포"
  | "디자인"
  | "마케팅"
  | "영업/미팅"
  | "CS/고객대응"
  | "정산/회계"
  | "채용/인사"
  | "기획"
  | "문서/운영"
  | "기타";

const RULES: { category: TaskCategory; keywords: string[] }[] = [
  { category: "개발/배포", keywords: ["개발", "배포", "버그", "릴리즈", "리팩", "빌드", "api", "서버", "db", "코드", "에러", "오류", "deploy", "qa", "테스트", "fix", "hotfix", "패치", "머지", "커밋"] },
  { category: "디자인", keywords: ["디자인", "시안", "ui", "ux", "배너", "로고", "목업", "썸네일", "figma", "피그마", "아이콘", "포스터", "키비주얼"] },
  { category: "마케팅", keywords: ["마케팅", "광고", "sns", "캠페인", "프로모션", "콘텐츠", "seo", "홍보", "이벤트", "인스타", "유튜브", "블로그"] },
  { category: "영업/미팅", keywords: ["영업", "미팅", "회의", "상담", "제휴", "계약", "견적", "발표", "세일즈", "방문", "제안서", "데모"] },
  { category: "CS/고객대응", keywords: ["cs", "문의", "응대", "클레임", "컴플레인", "민원", "반품", "교환", "고객대응", "a/s"] },
  { category: "정산/회계", keywords: ["정산", "회계", "세금", "인보이스", "invoice", "비용", "지출", "매출", "급여", "결제", "예산", "세무", "경비"] },
  { category: "채용/인사", keywords: ["채용", "면접", "인터뷰", "지원자", "이력서", "온보딩", "리크루팅", "인사", "평가", "연봉"] },
  { category: "기획", keywords: ["기획", "계획", "로드맵", "전략", "정책", "아이디어", "컨셉", "기획서", "리서치", "조사", "분석"] },
  { category: "문서/운영", keywords: ["문서", "정리", "보고", "리포트", "회고", "매뉴얼", "가이드", "운영", "점검", "백업"] },
];

export function categorizeTask(title: string, description?: string | null): TaskCategory {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.category;
  }
  return "기타";
}
