import {
  isLiveCampaignStatus,
  selectLiveCampaigns,
} from "@/lib/dashboard/active-campaigns";

describe("isLiveCampaignStatus", () => {
  it("treats missing status as live", () => {
    expect(isLiveCampaignStatus(null)).toBe(true);
    expect(isLiveCampaignStatus(undefined)).toBe(true);
    expect(isLiveCampaignStatus("")).toBe(true);
  });

  it("treats active and pending as live", () => {
    expect(isLiveCampaignStatus("active")).toBe(true);
    expect(isLiveCampaignStatus("pending")).toBe(true);
  });

  it("excludes closed statuses", () => {
    expect(isLiveCampaignStatus("completed")).toBe(false);
    expect(isLiveCampaignStatus("cancelled")).toBe(false);
    expect(isLiveCampaignStatus("draft")).toBe(false);
  });
});

describe("selectLiveCampaigns", () => {
  const campaigns = [
    { id: "1", status: "active", created_at: "2026-01-10T00:00:00.000Z" },
    { id: "2", status: "pending", created_at: "2026-08-05T00:00:00.000Z" },
    { id: "3", status: "completed", created_at: "2026-08-01T00:00:00.000Z" },
  ];

  it("counts currently live campaigns even if they were created before the selected period", () => {
    const live = selectLiveCampaigns(campaigns);
    expect(live.map((campaign) => campaign.id)).toEqual(["1", "2"]);
  });

  it("uses created_at only for the previous-period comparison", () => {
    const previous = selectLiveCampaigns(
      campaigns,
      new Date("2026-07-12T00:00:00.000Z"),
    );
    expect(previous.map((campaign) => campaign.id)).toEqual(["1"]);
  });
});
