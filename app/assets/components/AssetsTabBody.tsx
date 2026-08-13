"use client"

import { TabsContent } from "@/app/components/ui/tabs"
import { AssetCard } from "./AssetCard"
import { AssetsTable } from "./AssetsTable"
import { isAssetCompatibleWithAgent, type AssetViewType, type AssetWithThumbnail } from "./asset-utils"

function filterByTab(assets: AssetWithThumbnail[], tab: "all" | "images" | "videos" | "documents") {
  if (tab === "images") return assets.filter((a) => a.file_type.startsWith("image/"))
  if (tab === "videos") return assets.filter((a) => a.file_type.startsWith("video/"))
  if (tab === "documents") return assets.filter((a) => !a.file_type.startsWith("image/") && !a.file_type.startsWith("video/"))
  return assets
}

interface AssetsTabBodyProps {
  tab: "all" | "images" | "videos" | "documents"
  assets: AssetWithThumbnail[]
  viewType: AssetViewType
  agentId?: string
  onDelete: (id: string) => void
  onAttach: (id: string) => void
  onDetach: (id: string) => void
}

export function AssetsTabBody({
  tab,
  assets,
  viewType,
  agentId,
  onDelete,
  onAttach,
  onDetach,
}: AssetsTabBodyProps) {
  const rows = filterByTab(assets, tab)

  if (viewType === "list") {
    return (
      <TabsContent value={tab} className="mt-0 space-y-4">
        <AssetsTable
          assets={rows}
          emptyType={tab}
          onDelete={onDelete}
          onAttach={onAttach}
          onDetach={onDetach}
          agentId={agentId}
        />
      </TabsContent>
    )
  }

  return (
    <TabsContent value={tab} className="mt-0 space-y-4">
      {rows.length === 0 ? (
        <AssetsTable assets={[]} emptyType={tab} onDelete={onDelete} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => onDelete(asset.id)}
              onAttach={onAttach}
              onDetach={onDetach}
              isCompatibleWithAgent={isAssetCompatibleWithAgent(asset)}
              agentId={agentId}
            />
          ))}
        </div>
      )}
    </TabsContent>
  )
}
