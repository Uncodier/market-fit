"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { createAsset } from "@/app/assets/actions"
import { UploadAssetDialog } from "@/app/components/upload-asset-dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ContentEditorPane } from "./components/ContentEditorPane"
import { ContentPublishDialog } from "./components/ContentPublishDialog"
import { ContentRightPanel } from "./components/ContentRightPanel"
import { ContentSkeleton } from "./content-detail-skeleton"
import { useContentItemController } from "./hooks/use-content-item-controller"
import "../styles/editor.css"

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const { t } = useLocalization()
  const controller = useContentItemController(id)

  if (controller.isLoading) return <ContentSkeleton />

  const outstandTag = controller.content?.tags?.find(
    (tag: string) => tag.startsWith("outstand_id_"),
  )
  const outstandPostId = outstandTag?.replace("outstand_id_", "")

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height,64px))]">
      {controller.content?.id && (
        <UploadAssetDialog
          contentId={controller.content.id}
          onUploadAsset={async (data) => {
            const result = await createAsset(data)
            if (result.error) throw new Error(result.error)
          }}
          open={controller.uploadDialogOpen}
          onOpenChange={controller.setUploadDialogOpen}
          noTrigger
          onSuccess={controller.refreshAssets}
        />
      )}

      <ContentEditorPane
        content={controller.content}
        editor={controller.editor}
        instructionsEditor={controller.instructionsEditor}
        activeTab={controller.activeTab}
        setActiveTab={controller.setActiveTab}
        isSaving={controller.isSaving}
        hasChanges={controller.hasUnsavedChanges()}
        isEditorFocused={controller.isEditorFocused}
        assetsRefreshTrigger={controller.assetsRefreshTrigger}
        onSave={controller.saveContent}
        onDelete={controller.handleDeleteContent}
        onTeleprompter={() => router.push(`/teleprompter/${controller.content.id}`)}
        onUploadAsset={() => controller.setUploadDialogOpen(true)}
      />

      <ContentRightPanel
        content={controller.content}
        editForm={controller.editForm}
        setEditForm={controller.setEditForm}
        campaigns={controller.campaigns}
        segments={controller.segments}
        editorsReady={controller.editorsReady}
        setHasUserMadeChanges={controller.setHasUserMadeChanges}
        outstandPostId={outstandPostId}
        isGenerating={controller.isGenerating}
        contentStyle={controller.contentStyle}
        setContentStyle={controller.setContentStyle}
        expertise={controller.expertise}
        setExpertise={controller.setExpertise}
        interests={controller.interests}
        setInterests={controller.setInterests}
        topicsToAvoid={controller.topicsToAvoid}
        setTopicsToAvoid={controller.setTopicsToAvoid}
        aiPrompt={controller.aiPrompt}
        setAiPrompt={controller.setAiPrompt}
        generateContent={controller.generateContent}
      />

      <ContentPublishDialog
        publishingContent={controller.publishingContent}
        socialMedia={controller.socialMedia}
        selectedNetworks={controller.selectedNetworks}
        setSelectedNetworks={controller.setSelectedNetworks}
        scheduleEnabled={controller.scheduleEnabled}
        setScheduleEnabled={controller.setScheduleEnabled}
        scheduledDate={controller.scheduledDate}
        setScheduledDate={controller.setScheduledDate}
        dateLabel={t("datePicker.selectDateTime")}
        close={controller.closePublishDialog}
        submit={controller.submitPublish}
        connectAccounts={() => router.push("/settings/social_network")}
      />
    </div>
  )
}
