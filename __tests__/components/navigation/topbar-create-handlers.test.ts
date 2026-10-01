import { createSegment } from "@/app/segments/actions";
import { createExperiment } from "@/app/experiments/actions";
import { createRequirement } from "@/app/requirements/actions";
import { createAsset } from "@/app/assets/actions";
import { createLead } from "@/app/leads/actions";
import { createDeal, addDealContact } from "@/app/deals/actions";
import { safeReload } from "@/app/utils/safe-reload";
import {
  handleCreateSegment, handleCreateExperiment, handleCreateRequirement,
  handleCreateAsset, handleCreateLead, handleCreateDeal,
} from "@/app/components/navigation/topbar-create-handlers";

jest.mock("@/app/segments/actions", () => ({ createSegment: jest.fn() }));
jest.mock("@/app/experiments/actions", () => ({ createExperiment: jest.fn() }));
jest.mock("@/app/requirements/actions", () => ({ createRequirement: jest.fn() }));
jest.mock("@/app/assets/actions", () => ({ createAsset: jest.fn() }));
jest.mock("@/app/leads/actions", () => ({ createLead: jest.fn() }));
jest.mock("@/app/deals/actions", () => ({ createDeal: jest.fn(), addDealContact: jest.fn() }));
jest.mock("@/app/utils/safe-reload", () => ({ safeReload: jest.fn() }));

const segment = { name: "Segment", description: "", audience: "Buyers", language: "en", site_id: "site-one" };
const asset = { name: "Asset", file_path: "asset.png", file_type: "image/png", file_size: 10, tags: [], site_id: "site-one" };
const lead = { name: "Lead", email: "lead@example.test", site_id: "site-one" };
const deal = { name: "Deal", site_id: "site-one", lead_id: "lead-one" };
const target = window as Window & { refreshDealsList?: () => void };

beforeEach(() => {
  jest.resetAllMocks();
});

afterEach(() => {
  delete target.refreshDealsList;
  jest.restoreAllMocks();
});

it("preserves segment and asset creation payloads and reloads", async () => {
  jest.mocked(createSegment).mockResolvedValue({});
  jest.mocked(createAsset).mockResolvedValue({});
  await handleCreateSegment(segment);
  await handleCreateAsset(asset);
  expect(createSegment).toHaveBeenCalledWith(segment);
  expect(createAsset).toHaveBeenCalledWith(asset);
  expect(safeReload).toHaveBeenCalledWith(false, "New segment created");
  expect(safeReload).toHaveBeenCalledWith(false, "New asset created");
});

it("keeps segment and asset action errors as rejected promises", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(createSegment).mockResolvedValue({ error: "Segment rejected" });
  jest.mocked(createAsset).mockResolvedValue({ error: "Asset rejected" });
  await expect(handleCreateSegment(segment)).rejects.toThrow("Segment rejected");
  await expect(handleCreateAsset(asset)).rejects.toThrow("Asset rejected");
  expect(safeReload).not.toHaveBeenCalled();
});

it("returns created experiments and reloads after success", async () => {
  const values = { name: "Experiment", site_id: "site-one" } as Parameters<typeof handleCreateExperiment>[0];
  const data = { id: "experiment-one" };
  jest.mocked(createExperiment).mockResolvedValue({ data });
  await expect(handleCreateExperiment(values)).resolves.toEqual({ data });
  expect(createExperiment).toHaveBeenCalledWith(values);
  expect(safeReload).toHaveBeenCalledWith(false, "New experiment created");
});

it("dispatches requirement reload without a full-page reload", async () => {
  const values = { title: "Requirement", site_id: "site-one" } as Parameters<typeof handleCreateRequirement>[0];
  const data = { id: "requirement-one" };
  const listener = jest.fn();
  window.addEventListener("requirements:reload", listener);
  jest.mocked(createRequirement).mockResolvedValue({ data });
  await expect(handleCreateRequirement(values)).resolves.toEqual({ data });
  expect(createRequirement).toHaveBeenCalledWith(values);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(safeReload).not.toHaveBeenCalled();
  window.removeEventListener("requirements:reload", listener);
});

it("keeps requirement and experiment action errors in their result contracts", async () => {
  jest.mocked(createExperiment).mockResolvedValue({ error: "Experiment rejected" });
  jest.mocked(createRequirement).mockResolvedValue({ error: "Requirement rejected" });
  await expect(handleCreateExperiment({} as Parameters<typeof handleCreateExperiment>[0])).resolves.toEqual({ error: "Experiment rejected" });
  await expect(handleCreateRequirement({} as Parameters<typeof handleCreateRequirement>[0])).resolves.toEqual({ error: "Requirement rejected" });
  expect(safeReload).not.toHaveBeenCalled();
});

it("preserves lead payloads and returns the created lead", async () => {
  const created = { id: "lead-one" } as NonNullable<Awaited<ReturnType<typeof createLead>>["lead"]>;
  jest.mocked(createLead).mockResolvedValue({ lead: created });
  await expect(handleCreateLead(lead)).resolves.toEqual({ lead: created });
  expect(createLead).toHaveBeenCalledWith(lead);
  expect(safeReload).toHaveBeenCalledWith(false, "New lead created");
});

it("links a selected deal contact before refreshing the list", async () => {
  const created = { id: "deal-one" } as NonNullable<Awaited<ReturnType<typeof createDeal>>["deal"]>;
  target.refreshDealsList = jest.fn();
  jest.mocked(createDeal).mockResolvedValue({ deal: created, error: null });
  await expect(handleCreateDeal(deal)).resolves.toEqual({ deal: created });
  expect(createDeal).toHaveBeenCalledWith({ name: "Deal", site_id: "site-one" });
  expect(addDealContact).toHaveBeenCalledWith("deal-one", "lead-one", "Primary Contact", true);
  expect(target.refreshDealsList).toHaveBeenCalledTimes(1);
  expect(safeReload).not.toHaveBeenCalled();
});

it("reloads the deal list when no refresh handler is mounted", async () => {
  const created = { id: "deal-one" } as NonNullable<Awaited<ReturnType<typeof createDeal>>["deal"]>;
  jest.mocked(createDeal).mockResolvedValue({ deal: created, error: null });
  await handleCreateDeal({ name: "Deal", site_id: "site-one" });
  expect(addDealContact).not.toHaveBeenCalled();
  expect(safeReload).toHaveBeenCalledWith(false, "New deal created");
});

it("returns failed lead/deal action results without refreshing", async () => {
  jest.mocked(createLead).mockResolvedValue({ error: "Lead rejected" });
  jest.mocked(createDeal).mockResolvedValue({ deal: null, error: "Deal rejected" });
  await expect(handleCreateLead(lead)).resolves.toEqual({ error: "Lead rejected" });
  await expect(handleCreateDeal(deal)).resolves.toEqual({ error: "Deal rejected" });
  expect(addDealContact).not.toHaveBeenCalled();
  expect(safeReload).not.toHaveBeenCalled();
});

it("returns thrown creation errors through the dialog contracts", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(createLead).mockRejectedValue(new Error("Lead failed"));
  jest.mocked(createDeal).mockRejectedValue(new Error("Deal failed"));
  await expect(handleCreateLead(lead)).resolves.toEqual({ error: "Lead failed" });
  await expect(handleCreateDeal(deal)).resolves.toEqual({ error: "Deal failed" });
});