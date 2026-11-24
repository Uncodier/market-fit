import { useCallback, useState, type ComponentProps } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { Button } from '../ui/button'
import { Plus } from '../ui/icons'
import { CreateSegmentDialog } from '../create-segment-dialog'
import { CreateExperimentDialog } from '../create-experiment-dialog'
import { CreateRequirementDialog } from '../create-requirement-dialog'
import { CreateLeadDialog } from '../create-lead-dialog'
import { UploadAssetDialog } from '../upload-asset-dialog'
import { CreateContentDialog } from '@/app/content/components'
import { TopBarCampaignAction } from './TopBarCampaignAction'
import { safeReload } from '@/app/utils/safe-reload'
import { handleCreateSegment, handleCreateExperiment, handleCreateRequirement, handleCreateLead, handleCreateAsset } from './topbar-create-handlers'
import type { TopBarActionsProps } from './topbar-action-types'
import { useTopbarOptions, type PickerDialog } from './use-topbar-options'
import { useTopbarDialogScope } from './topbar-dialog-scope'

type CreationProps = Pick<TopBarActionsProps,
  'isSegmentsPage' | 'isExperimentsPage' | 'isRequirementsPage' | 'isLeadsPage' |
  'isAssetsPage' | 'isContentPage' | 'isCampaignsPage' | 'segments' | 'campaigns'
>
type PickerProps = Pick<CreationProps, 'segments' | 'campaigns'> & { dialog: PickerDialog }

function CreationButton({ label, title = label, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return <Button {...props} title={title}
    className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm">
    <Plus className="h-4 w-4 shrink-0" />
    <span className="hidden sm:inline ml-2">{label}</span>
  </Button>
}

const actionLabels = {
  leads: 'layout.topbar.addLead', content: 'layout.topbar.newContent', campaigns: 'layout.topbar.newCampaign',
  requirements: 'layout.topbar.newRequirement', experiments: 'layout.topbar.newExperiment',
} satisfies Record<PickerDialog, string>

function refreshContent() {
  const refresh = (window as Window & { refreshContentList?: () => void }).refreshContentList
  if (refresh) refresh()
  else safeReload(false, 'New content created')
}

function PickerAction(props: PickerProps) {
  const scope = useTopbarDialogScope(props.dialog)
  return <PickerSession key={scope.key} {...props} siteId={scope.siteId} scopeReady={scope.scopeReady} />
}

function PickerSession({ dialog, siteId, scopeReady, segments, campaigns }:
  PickerProps & { siteId: string | null; scopeReady: boolean }) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const onOpenChange = useCallback((next: boolean) => setOpen(next && !!siteId), [siteId])
  const options = useTopbarOptions(dialog, open ? siteId : null, segments, campaigns)
  const props = {
    onOpenChange,
    optionsStatus: options,
    segments: options.segments,
    campaigns: options.campaigns,
    trigger: <CreationButton label={t(actionLabels[dialog])} title={dialog === 'leads' ? 'Add Lead' : undefined}
      disabled={!scopeReady} />,
  }
  switch (dialog) {
    case 'requirements': return <CreateRequirementDialog {...props} open={open} onCreateRequirement={handleCreateRequirement} />
    case 'experiments': return <CreateExperimentDialog {...props} open={open} onCreateExperiment={handleCreateExperiment} />
    case 'leads': return <CreateLeadDialog {...props} open={open} onCreateLead={handleCreateLead} />
    case 'content': return <CreateContentDialog {...props} isOpen={open} onSuccess={refreshContent} />
    case 'campaigns': return <TopBarCampaignAction {...props} open={open} />
  }
}

export function TopBarCreationActions({
  isSegmentsPage, isExperimentsPage, isRequirementsPage, isLeadsPage,
  isAssetsPage, isContentPage, isCampaignsPage, segments, campaigns,
}: CreationProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  if (!currentSite) return null
  if (isSegmentsPage) return <CreateSegmentDialog onCreateSegment={handleCreateSegment}
    trigger={<CreationButton label={t('layout.topbar.newSegment')} />} />
  if (isAssetsPage) return <UploadAssetDialog onUploadAsset={handleCreateAsset} />

  const dialog = isLeadsPage ? 'leads' : isContentPage ? 'content' : isCampaignsPage ? 'campaigns' :
    isRequirementsPage ? 'requirements' : isExperimentsPage ? 'experiments' : null
  return dialog && <PickerAction dialog={dialog} segments={segments} campaigns={campaigns} />
}