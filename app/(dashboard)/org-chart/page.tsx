import { getOrgChartData } from "./actions";
import OrgChartView from "./org-chart-view";

export default async function OrgChartPage() {
  const members = await getOrgChartData();

  return <OrgChartView initialMembers={members ?? []} />;
}
