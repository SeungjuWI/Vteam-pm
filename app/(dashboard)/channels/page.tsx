import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { getMyChannels, getCompanyMembers } from "./actions";
import ChannelsView from "./channels-view";

export default async function ChannelsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const isAdmin = profile.role === "admin";

  const [departments, companyMembers] = await Promise.all([
    getMyChannels(),
    isAdmin ? getCompanyMembers() : Promise.resolve([]),
  ]);

  return (
    <ChannelsView
      currentUserId={user.id}
      currentUserLang={profile.language ?? "ko"}
      isAdmin={isAdmin}
      initialDepartments={departments}
      companyMembers={companyMembers}
    />
  );
}
