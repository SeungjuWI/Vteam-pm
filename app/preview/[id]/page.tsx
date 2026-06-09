// [DEV] 프리뷰 프로젝트 상세 라우트. 로그인 없이 마일스톤/보드 뷰 미리보기.
import DetailView from "../detail-view";

const NAMES: Record<string, string> = { ktc: "KTC", fyi: "FYI", hire: "채용공고" };

export default async function PreviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView projectName={NAMES[id] || "프로젝트"} />;
}
