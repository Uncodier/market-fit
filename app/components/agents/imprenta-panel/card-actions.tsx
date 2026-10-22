import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Plus, Play, GitFork, Copy, Download, Send } from "@/app/components/ui/icons"
import { copyToClipboard } from "@/app/utils/clipboard"
import { toast } from "sonner"

import type { ImprentaNodeCardProps } from './card-types'

export function ImprentaCardActions({ isVisualMediaCard, actions, node, hasResult, resultBtnVariant, resultBtnClass, contexts, resultIconClass, needAudience, setIsTestDialogOpen }: Pick<ImprentaNodeCardProps, "actions" | "node" | "hasResult" | "contexts" | "needAudience"> & {
  isVisualMediaCard: boolean
  resultBtnVariant: "ghost" | "outline"
  resultBtnClass: string
  resultIconClass: string
  setIsTestDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return <><div className={cn(
    isVisualMediaCard
      ? "absolute inset-x-0 bottom-0 z-10 transition-opacity opacity-100 pointer-events-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto"
      : "flex items-center justify-between pt-3 border-t border-white/5"
  )}>
    {isVisualMediaCard && (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        aria-hidden
      />
    )}
    {(() => {
      const parentNode = actions.getParentNode(node);
      return hasResult ? (
        <div className={cn("flex gap-2 w-full", isVisualMediaCard && "relative px-3 pb-3")}>
          <Button
            variant={resultBtnVariant}
            size="sm"
            className={resultBtnClass}
            disabled={
              node.status === 'running' ||
              node.status === 'pending' ||
              node.status === 'failed' ||
              (!!(node.settings)?.imprenta_mode && !contexts.some(ctx => ctx.target_node_id === node.id)) ||
              // Disable if media was intended but failed to extract
              ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings)?.media_type === 'image' || (node.settings)?.media_type === 'video' || (node.settings)?.media_type === 'audio' ||
                (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings)?.media_type === 'image' || (parentNode.settings)?.media_type === 'video' || (parentNode.settings)?.media_type === 'audio'))) &&
                !(!!(node.result).outputs || !!(node.result).media || !!(node.result).images || !!(node.result).image || !!(node.result).video || !!(node.result).audio) &&
                !(node.result)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                !(node.result)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
            }
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={async (e) => {
              e.stopPropagation();
              const parentNode = actions.getParentNode(node);
              if (parentNode) {
                actions.handleExecuteNode(parentNode);
              } else {
                actions.handleExecuteNode(node); // Fallback: execute current if root
              }
            }}
            title="New Variant"
          >
            <GitFork className={resultIconClass} /> Variant
          </Button>
          <Button
            variant={resultBtnVariant}
            size="sm"
            className={resultBtnClass}
            disabled={
              node.status === 'running' ||
              node.status === 'pending' ||
              node.status === 'failed' ||
              ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings)?.media_type === 'image' || (node.settings)?.media_type === 'video' || (node.settings)?.media_type === 'audio' ||
                (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings)?.media_type === 'image' || (parentNode.settings)?.media_type === 'video' || (parentNode.settings)?.media_type === 'audio'))) &&
                !(!!(node.result).outputs || !!(node.result).media || !!(node.result).images || !!(node.result).image || !!(node.result).video || !!(node.result).audio) &&
                !(node.result)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                !(node.result)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
            }
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              actions.handleCreateActionFromContext(node.id);
            }}
            title="New Action"
          >
            <Plus className={resultIconClass} /> Action
          </Button>
          <Button
            variant={resultBtnVariant}
            size="sm"
            className={resultBtnClass}
            disabled={
              node.status === 'running' ||
              node.status === 'pending' ||
              node.status === 'failed' ||
              ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings)?.media_type === 'image' || (node.settings)?.media_type === 'video' || (node.settings)?.media_type === 'audio' ||
                (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings)?.media_type === 'image' || (parentNode.settings)?.media_type === 'video' || (parentNode.settings)?.media_type === 'audio'))) &&
                !(!!(node.result).outputs || !!(node.result).media || !!(node.result).images || !!(node.result).image || !!(node.result).video || !!(node.result).audio) &&
                !(node.result)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                !(node.result)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
            }
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={async (e) => {
              e.stopPropagation();
              const res = node.result;
              let textToCopy = "";

              if (res.outputs && Array.isArray(res.outputs) && res.outputs.length > 0 && (res.outputs[0]?.data?.url || res.outputs[0]?.url)) textToCopy = String(res.outputs[0].data?.url || res.outputs[0].url);
              else if (res.media && Array.isArray(res.media) && res.media.length > 0 && res.media[0]?.url) textToCopy = String(res.media[0].url);
              else if (res.url) textToCopy = String(res.url);
              else if (res.images && res.images.length > 0 && res.images[0]?.url) textToCopy = String(res.images[0].url);
              else if (res.image && res.image.url) textToCopy = String(res.image.url);
              else if (res.audio && res.audio.url) textToCopy = String(res.audio.url);
              else if (res.video && res.video.url) textToCopy = String(res.video.url);
              else if (res.text) textToCopy = String(res.text);
              else textToCopy = JSON.stringify(res, null, 2);

              try {
                const success = await copyToClipboard(textToCopy);
                if (success) {
                  toast.success("Copied to clipboard");
                } else {
                  toast.error("Failed to copy");
                }
              } catch {
                toast.error("Failed to copy");
              }
            }}
            title="Copy Result"
          >
            <Copy className={resultIconClass} /> Copy
          </Button>
          {(() => {
            const extractUrl = (text: unknown): string => {
              if (!text) return '';
              const str = String(text);
              const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/);
              return urlMatch ? urlMatch[0] : str;
            };

            const res = node.result;
            let rawAssetUrl = "";

            if (res.outputs && Array.isArray(res.outputs) && res.outputs.length > 0 && (res.outputs[0]?.data?.url || res.outputs[0]?.url)) rawAssetUrl = String(res.outputs[0].data?.url || res.outputs[0].url);
            else if (res.media && Array.isArray(res.media) && res.media.length > 0 && res.media[0]?.url) rawAssetUrl = String(res.media[0].url);
            else if (res.images && res.images.length > 0 && res.images[0]?.url) rawAssetUrl = String(res.images[0].url);
            else if (res.image && res.image.url) rawAssetUrl = String(res.image.url);
            else if (res.audio && res.audio.url) rawAssetUrl = String(res.audio.url);
            else if (res.video && res.video.url) rawAssetUrl = String(res.video.url);
            else if (res.url) rawAssetUrl = String(res.url);

            const assetUrl = extractUrl(rawAssetUrl);
            const isAssetUrl = assetUrl && (assetUrl.startsWith('http') || assetUrl.startsWith('data:'));

            return (
              <Button
                variant={resultBtnVariant}
                size="sm"
                className={resultBtnClass}
                disabled={
                  node.status === 'running' ||
                  node.status === 'pending' ||
                  node.status === 'failed' ||
                  ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings)?.media_type === 'image' || (node.settings)?.media_type === 'video' || (node.settings)?.media_type === 'audio' ||
                    (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings)?.media_type === 'image' || (parentNode.settings)?.media_type === 'video' || (parentNode.settings)?.media_type === 'audio'))) &&
                    !(!!(node.result).outputs || !!(node.result).media || !!(node.result).images || !!(node.result).image || !!(node.result).video || !!(node.result).audio) &&
                    !(node.result)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                    !(node.result)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
                }
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isAssetUrl) {
                    try {
                      const response = await fetch(assetUrl);
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = assetUrl.split('/').pop()?.split('?')[0] || `asset-${Date.now()}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                      toast.success("Downloaded");
                    } catch {
                      window.open(assetUrl, '_blank');
                    }
                  } else {
                    // Download text result
                    let textToDownload = "";
                    if (res.text) textToDownload = String(res.text);
                    else textToDownload = JSON.stringify(res, null, 2);

                    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `result-${Date.now()}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                    toast.success("Downloaded result");
                  }
                }}
                title="Download Result"
              >
                <Download className={resultIconClass} /> Download
              </Button>
            );
          })()}
        </div>
      ) : (
        <div className="flex w-full gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            title="Generate"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              actions.handleExecuteNode(node);
            }}
          >
            <Play className="w-4 h-4 mr-2" /> Generate
          </Button>
          {node.type === "publish" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-[0.5]"
              title={needAudience ? "Send Test" : "Only available for direct channels (email, whatsapp, call, etc)"}
              disabled={!needAudience}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsTestDialogOpen(true);
              }}
            >
              <Send className="w-4 h-4 mr-2" /> Test
            </Button>
          )}
        </div>
      );
    })()}
  </div></>
}
