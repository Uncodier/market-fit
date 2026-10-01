import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { Button } from "../ui/button";
import { PlusCircle } from "../ui/icons";
import { CreateSegmentDialog } from "../create-segment-dialog";
import { CreateExperimentDialog } from "../create-experiment-dialog";
import { CreateRequirementDialog } from "../create-requirement-dialog";
import { CreateLeadDialog } from "../create-lead-dialog";
import { UploadAssetDialog } from "../upload-asset-dialog";
import { CreateContentDialog } from "@/app/content/components";
import { TopBarCampaignAction } from "./TopBarCampaignAction";
import { safeReload } from "@/app/utils/safe-reload";
import { handleCreateSegment, handleCreateExperiment, handleCreateRequirement, handleCreateLead, handleCreateAsset } from "./topbar-create-handlers";
import type { TopBarActionsProps } from "./topbar-action-types";

type CreationProps = Pick<TopBarActionsProps,
  "isSegmentsPage" | "isExperimentsPage" | "isRequirementsPage" | "isLeadsPage" |
  "isAssetsPage" | "isContentPage" | "isCampaignsPage" | "segments" | "propSegments" | "campaigns"
>;

export function TopBarCreationActions({
  isSegmentsPage, isExperimentsPage, isRequirementsPage, isLeadsPage,
  isAssetsPage, isContentPage, isCampaignsPage, segments, propSegments, campaigns,
}: CreationProps) {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  return (
    <>
      {isSegmentsPage &&
        (currentSite ? (
          <CreateSegmentDialog
            onCreateSegment={handleCreateSegment}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.newSegment")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newSegment")}
                </span>
              </Button>
            }
          />
        ) : null)}
      {isExperimentsPage &&
        (currentSite ? (
          <div className="flex items-center gap-2">
            <CreateExperimentDialog
              segments={segments || []}
              campaigns={campaigns}
              onCreateExperiment={handleCreateExperiment}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title={t("layout.topbar.newExperiment")}
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.newExperiment")}
                  </span>
                </Button>
              }
            />
          </div>
        ) : null)}
      {isRequirementsPage &&
        (currentSite ? (
          <>
            <CreateRequirementDialog
              segments={segments || []}
              campaigns={campaigns}
              onCreateRequirement={handleCreateRequirement}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title={t("layout.topbar.newRequirement")}
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.newRequirement")}
                  </span>
                </Button>
              }
            />
          </>
        ) : null)}
      {isLeadsPage &&
        (currentSite ? (
          <>
            <CreateLeadDialog
              segments={segments.length > 0 ? segments : propSegments || []}
              campaigns={campaigns}
              onCreateLead={handleCreateLead}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title="Add Lead"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.addLead")}
                  </span>
                </Button>
              }
            />
          </>
        ) : null)}
      {isAssetsPage &&
        (currentSite ? (
          <UploadAssetDialog onUploadAsset={handleCreateAsset} />
        ) : null)}
      {isContentPage &&
        (currentSite ? (
          <CreateContentDialog
            segments={segments.length > 0 ? segments : propSegments || []}
            onSuccess={() => {
              if (
                typeof window !== "undefined" &&
                (window as Window & { refreshContentList?: () => void }).refreshContentList
              ) {
                (window as Window & { refreshContentList?: () => void }).refreshContentList?.();
              } else {
                safeReload(false, "New content created");
              }
            }}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.newContent")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newContent")}
                </span>
              </Button>
            }
          />
        ) : null)}
      {isCampaignsPage &&
        (currentSite ? (
          <TopBarCampaignAction
            segments={segments.length > 0 ? segments : propSegments || []}
          />
        ) : null)}
    </>
  );
}
