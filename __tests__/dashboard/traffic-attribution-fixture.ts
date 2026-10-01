export const attributionFixture = {
  model: "session_entry",
  segments: [{ name: "Growth teams", value: 2 }, { name: "Unassigned segment", value: 2 }],
  campaigns: [{ name: "Autumn launch", value: 3 }, { name: "No campaign", value: 1 }],
  coverage: { totalSessions: 4, attributedSessions: 3, unattributedSessions: 1, segmentedSessions: 2, campaignSessions: 3 },
}

export const attributionResponse = () => ({ ok: true, json: async () => attributionFixture })