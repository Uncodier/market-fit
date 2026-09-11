"use client"
import { useMemo } from "react";
import { useRobots } from "@/app/context/RobotsContext";
import { WorkflowRunButton } from "@/app/components/workflows/workflow-run-button";
import { PublishButton } from "@/app/components/navigation/PublishButton";
import { useRequirementStatus } from "@/app/components/simple-messages-view/hooks/useRequirementStatus";
import { useSearchParams } from "next/navigation";
import { AddSecretDialog } from "@/app/components/ui/add-secret-dialog";
import { useToast } from "@/app/components/ui/use-toast";
import { Button } from "@/app/components/ui/button";
import { Key } from "@/app/components/ui/icons";
import { useLocalization } from "@/app/context/LocalizationContext";

export function RobotPrimaryActions({
  currentSite,
  viewMode,
}: {
  currentSite: any;
  viewMode?: string;
}) {
  const {
    getAllInstances,
    getInstanceById,
    isLoading: isLoadingRobots,
  } = useRobots();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLocalization();

  const allInstances = getAllInstances();
  const selectedInstanceParam = searchParams.get("instance");

  const activeRobotInstance = useMemo(() => {
    if (isLoadingRobots) return null;
    if (selectedInstanceParam && selectedInstanceParam !== "new") {
      const urlInstance = getInstanceById(selectedInstanceParam);
      if (urlInstance) return urlInstance;
    }
    if (allInstances.length > 0) {
      const sortedInstances = [...allInstances].sort((a, b) => {
        const aTime = new Date((a as any).updated_at || (a as any).created_at || 0).getTime();
        const bTime = new Date((b as any).updated_at || (b as any).created_at || 0).getTime();
        return bTime - aTime;
      });
      return sortedInstances[0];
    }
    return null;
  }, [selectedInstanceParam, allInstances, getInstanceById, isLoadingRobots]);

  const { requirementStatuses } = useRequirementStatus(activeRobotInstance);

  const latestPreviewUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.preview_url) {
        return status.preview_url;
      }
      if (
        !status.preview_url &&
        status.repo_url &&
        (status.repo_url.endsWith(".zip") ||
          status.repo_url.includes(".zip?") ||
          status.repo_url.endsWith(".tar.gz") ||
          status.repo_url.includes(".tar.gz?") ||
          status.repo_url.endsWith(".tar") ||
          status.repo_url.includes(".tar?"))
      ) {
        return status.repo_url;
      }
      if (
        !status.preview_url &&
        status.source_code &&
        (status.source_code.endsWith(".zip") ||
          status.source_code.includes(".zip?") ||
          status.source_code.endsWith(".tar.gz") ||
          status.source_code.includes(".tar.gz?") ||
          status.source_code.endsWith(".tar") ||
          status.source_code.includes(".tar?"))
      ) {
        return status.source_code;
      }
    }
    return null;
  }, [requirementStatuses]);

  const isPlainRobot = viewMode !== "workflow" && viewMode !== "imprenta" && selectedInstanceParam !== "new";

  return (
    <div className="flex items-center gap-2">
      {isPlainRobot && activeRobotInstance && (
        <AddSecretDialog
          instanceId={activeRobotInstance.id}
          onSecretCreated={() => {
            toast({
              title: "Success",
              description: "Secret added to the instance successfully."
            })
          }}
          trigger={
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              title={t("layout.topbar.addSecret") || "Add Secret"}
            >
              <Key className="h-4 w-4" />
            </Button>
          }
        />
      )}

      {isPlainRobot && latestPreviewUrl && currentSite && (
        <PublishButton siteId={currentSite.id} previewUrl={latestPreviewUrl} />
      )}

      {viewMode === "workflow" && <WorkflowRunButton />}
    </div>
  );
}
