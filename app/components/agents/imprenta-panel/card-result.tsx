import type { InstanceNode } from '@/app/types/instance-nodes'
import type { AudienceLeadRow } from "@/app/audiences/actions"
import { isDescendantOfAudienceNode, isValidPublishAudienceSource, resolveAudienceSegmentIdForImprenta } from "@/app/components/agents/imprenta-publish-context"
import { ImprentaAudienceLeadsCarousel } from "@/app/components/agents/imprenta-audience-leads-carousel"
import { AudioPlayer } from "../audio-player"
import { RotateCcw as RefreshCw, AlertCircle, Bot } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { inferImprentaResultMediaType } from './result-helpers'
import { MemoMarkdown } from './markdown'
import type { ImprentaNodeCardProps } from './card-types'
import { ImprentaUploadedFile } from '@/app/components/agents/imprenta-uploaded-file'

export function ImprentaCardResult({ hasResult, isVisualMediaCard, nodes, dummyNodes, actions, node, logs, currentSite, renderResultMedia, mediaAspect }: Pick<ImprentaNodeCardProps, "hasResult" | "nodes" | "dummyNodes" | "actions" | "node" | "logs" | "currentSite"> & {
  isVisualMediaCard: boolean
  renderResultMedia: (url: string, type: "image" | "video", key: React.Key) => React.ReactNode
  mediaAspect: string
}) {
  return <>{hasResult && (
    (() => {
      const extractUrl = (text: unknown): string => {
        if (!text) return '';
        const str = String(text);
        const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/);
        return urlMatch ? urlMatch[0] : str;
      };

      return (
        <div className={isVisualMediaCard ? "relative" : "flex flex-col gap-2"}>
          {(() => {
            const allNodes = [...nodes, ...dummyNodes]
            const parentNode = actions.getParentNode(node);
            const rawAudienceLeads = (() => {
              let raw = (node.result)?.audience_leads || (node.result)?.example_leads;
              if (!raw && typeof node.result === 'object') {
                try {
                  // Look inside stringified JSONs if present
                  for (const val of Object.values(node.result)) {
                    if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
                      const parsed = JSON.parse(val);
                      if (parsed && (parsed.audience_leads || parsed.example_leads)) {
                        raw = parsed.audience_leads || parsed.example_leads;
                        break;
                      }
                    }
                  }
                } catch { }
              }

              // Also search in logs if not found
              if (!raw && logs && logs.length > 0) {
                const nodeLogs = logs.filter((l) =>
                  l.command_id === node.id ||
                  l.details?.instance_node_id === node.id ||
                  l.details?.command_id === node.id
                )

                for (const log of nodeLogs) {
                  if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
                    if (log.tool_args?.audience_leads || log.tool_args?.example_leads) return log.tool_args.audience_leads || log.tool_args.example_leads;
                    if (log.tool_result?.audience_leads || log.tool_result?.example_leads) return log.tool_result.audience_leads || log.tool_result.example_leads;
                    if (log.details?.audience_leads || log.details?.example_leads) return log.details.audience_leads || log.details.example_leads;
                  }
                }

                // Fallback: search ALL tool calls named 'audience' in the instance logs
                const audienceLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result') && l.tool_name?.includes('audience')).reverse();
                for (const log of audienceLogs) {
                  if (log.tool_args?.audience_leads || log.tool_args?.example_leads) return log.tool_args.audience_leads || log.tool_args.example_leads;
                  if (log.tool_result?.audience_leads || log.tool_result?.example_leads) return log.tool_result.audience_leads || log.tool_result.example_leads;
                  if (log.details?.audience_leads || log.details?.example_leads) return log.details.audience_leads || log.details.example_leads;
                }

                // Fallback 3: Check nested in `tool_result.output.result` for Agent `tools` wrapper
                const allToolLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result')).reverse();
                for (const log of allToolLogs) {
                  const nestedResult = log.tool_result?.output?.result;
                  if (nestedResult?.audience_leads || nestedResult?.example_leads) return nestedResult.audience_leads || nestedResult.example_leads;
                }
              }

              return raw;
            })();

            const audienceTotalCount = (() => {
              const count = (node.result)?.total_count || (node.result)?.total_matched;
              if (count != null) return Number(count);

              if (logs && logs.length > 0) {
                const nodeLogs = logs.filter((l) =>
                  l.command_id === node.id ||
                  l.details?.instance_node_id === node.id ||
                  l.details?.command_id === node.id
                )
                for (const log of nodeLogs) {
                  if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
                    const c = log.tool_result?.total_count || log.tool_result?.total_matched || log.tool_args?.total_count || log.tool_args?.total_matched || log.details?.total_count || log.details?.total_matched;
                    if (c != null) return Number(c);
                  }
                }

                const allToolLogs = logs.filter(l => (l.log_type === 'tool_call' || l.log_type === 'tool_result')).reverse();
                for (const log of allToolLogs) {
                  const nestedResult = log.tool_result?.output?.result;
                  if (nestedResult?.total_count != null || nestedResult?.total_matched != null) {
                    return Number(nestedResult.total_count ?? nestedResult.total_matched);
                  }
                }
              }
              return undefined;
            })();
            // #region agent log
            // #endregion

            const embeddedLeads: AudienceLeadRow[] | undefined = Array.isArray(rawAudienceLeads)
              ? (rawAudienceLeads as AudienceLeadRow[]).map((l, idx) => ({
                ...l,
                id: l.id || `embedded-${idx}`,
                lead_id: l.lead_id || l.id, // Fallback to id if lead_id is missing
                audience_id: l.audience_id || (node.result)?.audience_id
              }))
              : undefined
            const resolvedId = resolveAudienceSegmentIdForImprenta(node, allNodes, logs)
            // #region agent log
            // #endregion
            const audienceId =
              resolvedId ||
              (embeddedLeads?.[0]?.audience_id
                ? String(embeddedLeads[0].audience_id)
                : "")

            const mediaType = inferImprentaResultMediaType(node, allNodes);

            const showLeadsCarousel =
              !!currentSite?.id &&
              (isValidPublishAudienceSource(node) ||
                isDescendantOfAudienceNode(node, allNodes) ||
                (parentNode && parentNode.type === 'generate-audience') ||
                mediaType === "audience") &&
              (!!audienceId || (embeddedLeads && embeddedLeads.length > 0))
            if (!showLeadsCarousel) return null
            return (
              <div className="w-full relative mt-2 pt-2 border-t border-border">
                <ImprentaAudienceLeadsCarousel
                  audienceId={audienceId || String(embeddedLeads?.[0]?.audience_id ?? "")}
                  siteId={currentSite.id}
                  embeddedLeads={embeddedLeads}
                  totalCount={audienceTotalCount}
                />
              </div>
            )
          })()}
          <ImprentaUploadedFile node={node} />
          {(node.result)?.outputs && Array.isArray((node.result).outputs) && (
            <div className="flex flex-col gap-2">
              {(node.result).outputs.map((outputItem: InstanceNode["result"], idx: number) => {
                const rawUrl = outputItem.data?.url || outputItem.url;
                if (!rawUrl) return null;
                const url = extractUrl(rawUrl);
                if (outputItem.type === 'image') return renderResultMedia(url, 'image', idx);
                if (outputItem.type === 'video') return renderResultMedia(url, 'video', idx);
                if (outputItem.type === 'audio') return <AudioPlayer key={url || idx} src={url} className="w-full" />;
                return null;
              })}
            </div>
          )}
          {(node.result).media && Array.isArray((node.result).media) && (
            <div className="flex flex-col gap-2">
              {(node.result).media.map((mediaItem: InstanceNode["result"], idx: number) => {
                if (!mediaItem.url) return null;
                const url = extractUrl(mediaItem.url);
                if (mediaItem.type === 'image') return renderResultMedia(url, 'image', idx);
                if (mediaItem.type === 'video') return renderResultMedia(url, 'video', idx);
                if (mediaItem.type === 'audio') return <AudioPlayer key={url || idx} src={url} className="w-full" />;
                return null;
              })}
            </div>
          )}
          {!(node.result).outputs && !(node.result).media && (node.result).images && Array.isArray((node.result).images) && (
            <div className="flex flex-col gap-2">
              {(node.result).images.map((img: InstanceNode["result"], idx: number) => (
                img.url && renderResultMedia(extractUrl(img.url), 'image', idx)
              ))}
            </div>
          )}
          {!(node.result).outputs && !(node.result).media && !(node.result).images && (node.result).image && (node.result).image.url && (
            renderResultMedia(extractUrl((node.result).image.url), 'image', 'single-img')
          )}
          {!(node.result).outputs && !(node.result).media && (node.result).video && (node.result).video.url && (
            renderResultMedia(extractUrl((node.result).video.url), 'video', 'single-vid')
          )}
          {!(node.result).outputs && !(node.result).media && (node.result).audio && (node.result).audio.url && (
            <AudioPlayer key={extractUrl((node.result).audio.url)} src={extractUrl((node.result).audio.url)} className="w-full" />
          )}
          {(() => {
            const allNodes = [...nodes, ...dummyNodes]
            const parentNode = actions.getParentNode(node);
            const isAudienceNode = node.type === "generate-audience" || inferImprentaResultMediaType(node, allNodes) === "audience" || (parentNode && parentNode.type === "generate-audience");

            const hasAnyTextOrNoMedia = ((node.result).text || (!(node.result).outputs && !(node.result).media && !(node.result).images && !(node.result).image && !(node.result).video && !(node.result).audio && !(node.result).text));

            if (isAudienceNode) {
              if (!hasAnyTextOrNoMedia && !(node.result).text) return null;
            } else {
              if (!hasAnyTextOrNoMedia) return null;
            }

            let textContent = (node.result).text
              ? String((node.result).text)
              : "```json\n" + JSON.stringify(node.result, null, 2) + "\n```";

            const hasStructuredMedia = !!(node.result).outputs || !!(node.result).media || !!(node.result).images || !!(node.result).image || !!(node.result).video || !!(node.result).audio;

            const isParentTextAction = parentNode && (parentNode.type === 'prompt' || parentNode.type === 'generate-text' || (parentNode.settings)?.media_type === 'text');

            // Detect intention: did this node intend to produce media?
            const isMediaIntent = !isParentTextAction && (node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' ||
              (node.settings)?.media_type === 'image' || (node.settings)?.media_type === 'video' || (node.settings)?.media_type === 'audio' ||
              (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' ||
                (parentNode.settings)?.media_type === 'image' || (parentNode.settings)?.media_type === 'video' || (parentNode.settings)?.media_type === 'audio')));

            let extractedUrl: string | null = null;
            if (isMediaIntent) {
              // If we ALREADY successfully parsed structured media, we don't need to show ANY text. 
              if (hasStructuredMedia) return null;

              // If we ONLY got text back from the agent for a media node, forcefully extract the media link and discard the conversational text.
              let expectedMediaType = (node.settings)?.media_type || node.type.replace('generate-', '');
              if (!['image', 'video', 'audio'].includes(expectedMediaType) && parentNode) {
                expectedMediaType = (parentNode.settings)?.media_type || parentNode.type.replace('generate-', '');
              }

              if (expectedMediaType === 'image') {
                const imgMatchMarkdown = textContent.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/);
                const imgMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                if (imgMatchMarkdown) extractedUrl = imgMatchMarkdown[1];
                else if (imgMatchUrl) extractedUrl = imgMatchUrl[0];

                if (extractedUrl) return renderResultMedia(extractedUrl, 'image', 'extracted-img');
              } else if (expectedMediaType === 'video') {
                const vidMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(mp4|webm|mov|mkv)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                if (vidMatchUrl) extractedUrl = vidMatchUrl[0];

                if (extractedUrl) return renderResultMedia(extractedUrl, 'video', 'extracted-vid');
              } else if (expectedMediaType === 'audio') {
                const audioMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(mp3|wav|ogg|m4a|aac|flac)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                if (audioMatchUrl) extractedUrl = audioMatchUrl[0];

                if (extractedUrl) return <AudioPlayer key="extracted-audio" src={extractedUrl} className="w-full" />;
              }

              // If no URL could be extracted yet and it's still running, show a placeholder
              if (!extractedUrl && (node.status === 'running' || node.status === 'pending')) {
                return (
                  <div
                    className={`w-full overflow-hidden rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center`}
                    style={{ aspectRatio: mediaAspect }}
                  >
                    <div className="relative w-full h-full">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
                      </div>
                    </div>
                  </div>
                );
              }

              // If completed and no media could be extracted (e.g. error message from agent),
              // we replace the text with an error placeholder and a retry button.
              if (!extractedUrl && (node.status === 'completed' || node.status === 'failed')) {
                return (
                  <div
                    className={`w-full overflow-hidden rounded-xl bg-muted/10 border border-destructive/20 flex flex-col items-center justify-center gap-3 p-6 text-center`}
                    style={{ aspectRatio: mediaAspect }}
                  >
                    <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-medium text-destructive">Failed to extract media</div>
                    <p className="text-xs text-muted-foreground mb-2">The AI responded with text instead of the expected format.</p>

                    <div className="flex gap-2 pointer-events-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          const parentNode = actions.getParentNode(node);
                          // Delete this faulty node and re-execute parent
                          actions.handleDeleteNode(node.id).then(() => {
                            if (parentNode) actions.handleExecuteNode(parentNode);
                          });
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Retry Generation
                      </Button>
                    </div>
                  </div>
                );
              }
            }

            // Only for Text (prompt) and Publish types, show the markdown
            if (hasStructuredMedia && textContent && !isParentTextAction) {
              textContent = textContent.replace(/https?:\/\/[^\s"'<>()]+\.(wav|mp3|ogg|m4a|aac|flac|webm)/gi, '').trim();
            }
            // For audience nodes, if there's no actual reasoning text and it's just a JSON dump with audience_id, don't show the code block
            if (isAudienceNode && !((node.result).text)) {
              return null;
            }

            if (!textContent) return null;

            return (
              <div className="text-xs bg-accent/10 border border-accent/20 p-3 rounded-xl text-accent-foreground prose prose-sm dark:prose-invert max-w-none">
                <MemoMarkdown text={textContent} />
              </div>
            );
          })()}
        </div>
      );
    })()
  )}</>
}
