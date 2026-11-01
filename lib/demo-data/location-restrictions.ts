import { getDemoSiteRole, type DemoRoleData } from "./site-role";

type DemoLocationData = DemoRoleData & {
  site_member_location_restrictions?: { site_id: string; site_member_id: string }[];
};

/** Fixture-only mirror of the deny-unscoped predicates; never authorizes a real site. */
export function demoHasSiteLocationRestrictions(
  data: DemoLocationData, selectedSiteId: string, userId: string | undefined, requestedSiteId: unknown,
): boolean {
  const role = getDemoSiteRole(data, selectedSiteId, userId, requestedSiteId);
  if (!role) return true;
  if (role === "owner" || role === "admin") return false;
  return hasMemberRestrictions(data, userId, selectedSiteId);
}

export function demoHasLocationRestrictions(
  data: DemoLocationData, selectedSiteId: string, userId: string | undefined,
): boolean {
  if (!getDemoSiteRole(data, selectedSiteId, userId, selectedSiteId)) return true;
  return (data.site_members || []).some(member => {
    if (member.user_id !== userId) return false;
    const role = getDemoSiteRole(data, selectedSiteId, userId, member.site_id);
    return role !== "owner" && role !== "admin" && hasMemberRestrictions(data, userId, member.site_id);
  });
}

function hasMemberRestrictions(data: DemoLocationData, userId: string | undefined, siteId: string): boolean {
  return (data.site_members || []).some(member => member.user_id === userId && member.site_id === siteId &&
    !!member.id && (data.site_member_location_restrictions || []).some(
      restriction => restriction.site_id === siteId && restriction.site_member_id === member.id,
    ));
}