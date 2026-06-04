import dynamic from "next/dynamic";
import { getOrgChartData } from "./actions";

const OrgChartView = dynamic(() => import("./org-chart-view"), {
  loading: () => (
    <div className="flex h-[calc(100vh-240px)] min-h-[480px] items-center justify-center">
      <p className="text-sm text-gray-400">조직도 불러오는 중...</p>
    </div>
  ),
});

export default async function OrgChartPage() {
  const members = await getOrgChartData();

  return <OrgChartView initialMembers={members ?? []} />;
}
