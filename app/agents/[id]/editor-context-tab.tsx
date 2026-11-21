import { useState } from "react"
import type { Asset } from "@/app/assets/actions"
import { ContextFilesSkeleton } from "@/app/agents/agent-detail-skeletons"
import { ContextFile } from "@/app/components/agents/context-file"
import { UploadFileDialog } from "@/app/components/agents/upload-file-dialog"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText, FolderOpen, Link, XCircle } from "@/app/components/ui/icons"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { TabsContent } from "@/app/components/ui/tabs"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { EditorFile } from "./editor-profile"
import { useContextAssets } from "./use-context-assets"

type Props = { siteId: string; agentId: string | null; files: EditorFile[]; search: string; onChange: (files: EditorFile[]) => void }

export function EditorContextTab(props: Props) {
  const { t } = useLocalization()
  if (props.agentId) return <ContextLibrary {...props} agentId={props.agentId} />
  return <TabsContent value="context" className="space-y-4">
    <SectionCard><SectionCardHeader title="Context Files" description={t("settings.agentChannels.saveFirst")} /></SectionCard>
  </TabsContent>
}

function ContextLibrary({ siteId, agentId, files, onChange, search }: Props & { agentId: string }) {
  const { assets, busy, toggle } = useContextAssets(siteId, agentId, files, onChange)
  function uploaded(updated: EditorFile) {
    onChange(files.some((file) => file.id === updated.id)
      ? files.map((file) => file.id === updated.id ? updated : file) : [...files, updated])
  }
  return <TabsContent value="context" className="space-y-4">
    <SectionCard className="mb-8">
      <SectionCardHeader title="Context Files" description="Add files that provide context for your agent" />
      <SectionCardContent>
        {busy === "files" ? <ContextFilesSkeleton /> : files.length ? <div className="space-y-2">
          {files.filter((file) => file.name.toLowerCase().includes(search.toLowerCase())).map((file) =>
            <ContextFile key={file.id} {...file} agentId={agentId} onRemove={(id) => toggle(id, "files")} onUpdate={uploaded} />)}
        </div> : <EmptyCard icon={<FileText className="h-10 w-10 text-muted-foreground" />} contentClassName="mb-4"
          title="No context files added" description="Add files to provide additional context for your agent" className="flex flex-col items-center justify-center py-8" />}
      </SectionCardContent>
      <ActionFooter><UploadFileDialog agentId={agentId} onFileUploaded={uploaded} buttonLabel="Add File" /></ActionFooter>
    </SectionCard>
    <SectionCard>
      <SectionCardHeader title="Available Assets" description="Compatible files from your site that can be attached to this agent" />
      <SectionCardContent>
        {assets === null || busy === "assets" ? <ContextFilesSkeleton /> : assets.length ? <div className="space-y-2">
          {assets.map((asset) => <AssetRow key={asset.id} asset={asset} attached={files.some((file) => file.id === asset.id)}
            disabled={!!busy} onToggle={() => toggle(asset.id, "assets")} />)}
        </div> : <EmptyCard icon={<FolderOpen className="h-10 w-10 text-muted-foreground" />} contentClassName="mb-4"
          title="No compatible assets found" description="Upload compatible files (PDF, CSV, MD, TXT, JSON, YAML, or images) to attach them to your agent"
          className="flex flex-col items-center justify-center py-8" />}
      </SectionCardContent>
    </SectionCard>
  </TabsContent>
}

function AssetRow({ asset, attached, disabled, onToggle }: { asset: Asset; attached: boolean; disabled: boolean; onToggle: () => void }) {
  const [brokenImage, setBrokenImage] = useState(false)
  const tags: string[] = Array.isArray(asset.metadata?.tags) ? asset.metadata.tags.filter((tag: unknown) => typeof tag === "string") : []
  return <div className="flex items-center justify-between gap-2 p-4 border rounded-lg hover:bg-muted/50 dark:hover:bg-gray-800/60">
    <div className="flex min-w-0 items-center gap-3">
      <div className="shrink-0 h-8 w-8 rounded bg-muted flex items-center justify-center">
        {asset.file_type.startsWith("image/") && !brokenImage ?
          // Asset previews can live on user-configured storage origins.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.file_path} alt={asset.name} className="h-8 w-8 rounded object-cover" onError={() => setBrokenImage(true)} /> :
          <FileText className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{asset.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{asset.file_type}</span>
          {tags.length > 0 && <><span>•</span><div className="flex gap-1">
            {tags.slice(0, 2).map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4">{tag}</Badge>)}
            {tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{tags.length - 2} more</span>}
          </div></>}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {attached && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Attached</Badge>}
      <Button variant="outline" size="sm" onClick={onToggle} disabled={disabled}>
        {attached ? <><XCircle className="h-3 w-3 mr-1" />Detach</> : <><Link className="h-3 w-3 mr-1" />Attach</>}
      </Button>
    </div>
  </div>
}