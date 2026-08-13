const CLOSED_CAMPAIGN_STATUSES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "draft",
]);

export function isLiveCampaignStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return !CLOSED_CAMPAIGN_STATUSES.has(status);
}

export function selectLiveCampaigns<T extends { status?: string | null; created_at?: string }>(
  campaigns: T[],
  createdBefore?: Date,
): T[] {
  return campaigns.filter((campaign) => {
    if (!isLiveCampaignStatus(campaign.status)) return false;
    if (!createdBefore || !campaign.created_at) return true;
    return new Date(campaign.created_at).getTime() < createdBefore.getTime();
  });
}
