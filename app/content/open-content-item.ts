import { createContent, type ContentItem } from "./actions"
import { createAsset, attachAssetToContent } from "@/app/assets/actions"
import { navigateToContent } from "@/lib/navigation/navigation-helpers"
import { toast } from "sonner"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

export async function openContentItem(
  content: ContentItem,
  siteId: string,
  router: AppRouterInstance,
) {
  if (content.id.startsWith("outstand-")) {
    try {
      const outstandId = content.id.replace("outstand-", "")
      const tagsToSave = content.tags && content.tags.length > 0
        ? content.tags
        : ["outstand_only", `outstand_id_${outstandId}`]

      const res = await createContent({
        title: content.title,
        description: content.description || undefined,
        type: content.type as any,
        siteId,
        status: content.status,
        tags: tagsToSave,
        text: content.text || content.content || "",
      })

      if (res.content) {
        if (content.assets && content.assets.length > 0) {
          const displayAssets = content.assets.filter((a: any) => a.file_type?.startsWith("image/") || a.file_type?.startsWith("video/"))
          for (const asset of displayAssets) {
            const createdAsset = await createAsset({
              site_id: siteId,
              file_path: asset.file_path,
              name: `outstand-asset-${outstandId}`,
              file_type: asset.file_type,
              file_size: 0,
            })
            if (createdAsset.asset && res.content) {
              await attachAssetToContent(res.content.id, createdAsset.asset.id, { is_primary: asset === displayAssets[0] })
            }
          }
        }
        navigateToContent({ contentId: res.content.id, contentTitle: res.content.title, router })
        return
      }
      toast.error(`Failed to save post to database: ${res.error || "Unknown error"}`)
      return
    } catch {
      toast.error("Failed to save post")
      return
    }
  }

  navigateToContent({ contentId: content.id, contentTitle: content.title, router })
}
