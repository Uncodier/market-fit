import type { ComponentProps } from "react";
import { createSegment } from "@/app/segments/actions";
import { createExperiment, type ExperimentFormValues } from "@/app/experiments/actions";
import { createAsset } from "@/app/assets/actions";
import { createRequirement, type RequirementFormValues } from "@/app/requirements/actions";
import { createLead } from "@/app/leads/actions";
import { createDeal, addDealContact } from "@/app/deals/actions";
import type { CreateLeadDialog } from "../create-lead-dialog";
import type { CreateDealDialog } from "@/app/deals/components/CreateDealDialog";
import { safeReload } from "@/app/utils/safe-reload";

export const handleCreateSegment = async ({
  name,
  description,
  audience,
  language,
  site_id,
}: {
  name: string;
  description: string;
  audience: string;
  language: string;
  site_id: string;
}) => {
  try {
    const result = await createSegment({
      name,
      description,
      audience,
      language,
      site_id,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // Reload to show the new segment
    safeReload(false, "New segment created");
  } catch (error) {
    console.error("Error creating segment:", error);
    throw error;
  }
};

export const handleCreateExperiment = async (
  values: ExperimentFormValues,
) => {
  try {
    const result = await createExperiment(values);

    if (result.error) {
      return { error: result.error };
    }

    // Reload to show the new experiment
    safeReload(false, "New experiment created");
    return { data: result.data };
  } catch (error) {
    console.error("Error creating experiment:", error);
    return {
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
};

export const handleCreateRequirement = async (
  values: RequirementFormValues,
) => {
  try {
    const result = await createRequirement(values);

    if (result.error) {
      return { error: result.error };
    }

    window.dispatchEvent(new Event("requirements:reload"));

    return { data: result.data };
  } catch (error) {
    console.error("Error creating requirement:", error);
    return {
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
};

export const handleCreateAsset = async ({
  name,
  description,
  file_path,
  file_type,
  file_size,
  tags,
  site_id,
}: {
  name: string;
  description?: string;
  file_path: string;
  file_type: string;
  file_size: number;
  tags: string[];
  site_id: string;
}) => {
  try {
    const result = await createAsset({
      name,
      description,
      file_path,
      file_type,
      file_size,
      tags,
      site_id,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // Reload to show the new asset
    safeReload(false, "New asset created");
  } catch (error) {
    console.error("Error creating asset:", error);
    throw error;
  }
};

export const handleCreateLead: ComponentProps<typeof CreateLeadDialog>["onCreateLead"] = async (data) => {
  try {
    const result = await createLead(data as Parameters<typeof createLead>[0]);

    if (result.error) {
      return { error: result.error };
    }

    // Reload to show the new lead
    safeReload(false, "New lead created");
    return { lead: result.lead };
  } catch (error) {
    console.error("Error creating lead:", error);
    return {
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
};

type DealInput = Parameters<ComponentProps<typeof CreateDealDialog>["onCreateDeal"]>[0] & { lead_id?: string };

export const handleCreateDeal = async (data: DealInput) => {
  try {
    const { lead_id, ...dealData } = data;
    const result = await createDeal(dealData as Parameters<typeof createDeal>[0]);

    if (result.error) {
      return { error: result.error };
    }

    // If a lead was selected, link it to the deal
    if (lead_id && result.deal?.id) {
      await addDealContact(result.deal.id, lead_id, "Primary Contact", true);
    }

    // Update UI without full page reload if possible
    if (typeof window !== "undefined" && (window as Window & { refreshDealsList?: () => void }).refreshDealsList) {
      (window as Window & { refreshDealsList?: () => void }).refreshDealsList?.();
    } else {
      safeReload(false, "New deal created");
    }

    return { deal: result.deal };
  } catch (error) {
    console.error("Error creating deal:", error);
    return {
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
};
