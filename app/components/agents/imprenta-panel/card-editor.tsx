import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { InstanceNode } from "@/app/types/instance-nodes"
import { ImprentaAutoResizeTextarea } from "../imprenta-auto-resize-textarea"
import { ImprentaAudienceChannelSelector } from "@/app/components/agents/imprenta-audience-channel-selector"
import { ImprentaPublishDestinationSelector } from "@/app/components/agents/imprenta-publish-destination-selector"
import { MediaParametersToolbar } from "../../simple-messages-view/components/MediaParametersToolbar"
import { applyVideoParameterChange } from "../../simple-messages-view/media-parameter-normalization"
import { isImprentaUploadedNode, IMPRENTA_MODE_OPTIONS } from './node-helpers'
import type { ImprentaNodeCardProps } from './card-types'

export function ImprentaCardEditor({
  actions,
  node,
  hasResult,
  nodes,
  generatingNodeIds,
  supabase,
  currentSite,
  textParams,
  imageParams,
  videoParams,
  audioParams,
}: Pick<ImprentaNodeCardProps, "actions" | "node" | "hasResult" | "nodes" | "generatingNodeIds" | "supabase" | "currentSite" | "textParams" | "imageParams" | "videoParams" | "audioParams">) {
  return <>{actions.isImprentaWorkflowActionNode(node) &&
    !hasResult &&
    !isImprentaUploadedNode(node) &&
    (() => {
      const hasRealChildren = nodes.some(
        (ch) => ch.parent_node_id === node.id && !String(ch.id).startsWith("dummy-")
      )
      const outputTypeLocked =
        hasRealChildren || node.status !== "pending" || generatingNodeIds.has(node.id)
      const lockedTitle = outputTypeLocked
        ? "Output type is locked. Duplicate this node to change it."
        : "Card mode"

      return (
        <div
          className="flex flex-wrap items-center bg-muted/50 p-1 rounded-2xl gap-1"
          title={lockedTitle}
        >
          {IMPRENTA_MODE_OPTIONS.map(({ type: modeType, label }) => (
            <Button
              key={modeType}
              type="button"
              disabled={outputTypeLocked}
              variant={node.type === modeType ? "outline" : "ghost"}
              size="sm"
              className={`flex-1 h-7 text-[11px] rounded-full font-medium ${node.type === modeType
                  ? "bg-background shadow-sm border-white/10"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              onClick={async (e) => {
                e.stopPropagation()
                if (outputTypeLocked) {
                  toast.error("Output type is locked. Duplicate this node to change it.")
                  return
                }
                actions.setNodes((prev: InstanceNode[]) =>
                  prev.map((n: InstanceNode) => (n.id === node.id ? { ...n, type: modeType } : n))
                )
                await actions.trackNodeSave(
                  node.id,
                  supabase
                    .from("instance_nodes")
                    .update({ type: modeType })
                    .eq("id", node.id),
                  "type"
                )
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )
    })()}
    {!hasResult && (
      <>
        <ImprentaAutoResizeTextarea
          defaultValue={node.prompt?.text || ''}
          onBlur={async (e) => {
            const newText = e.target.value;
            if (newText !== node.prompt?.text) {
              actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, prompt: { ...n.prompt, text: newText } } : n));
              const { error } = await actions.trackNodeSave(
                node.id,
                supabase
                  .from('instance_nodes')
                  .update({ prompt: { ...node.prompt, text: newText } })
                  .eq('id', node.id),
                "prompt"
              );

              if (error) {
                toast.error("Failed to save node text");
                console.error(error);
              }
            }
          }}
          className="min-h-[60px] resize-none overflow-hidden rounded-xl bg-muted/30 p-2 text-xs text-muted-foreground focus-visible:ring-1 focus-visible:ring-secondary"
          placeholder={node.type === 'publish' ? "Optional: custom instructions for publishing..." : "Type to edit prompt..."}
        />

        {node.type === 'generate-audience' && (
          <ImprentaAudienceChannelSelector
            channels={(node.settings)?.audience_channels}
            onChannelsChange={async (audienceChannels) => {
              actions.setNodes((prev: InstanceNode[]) => prev.map((item: InstanceNode) =>
                item.id === node.id
                  ? { ...item, settings: { ...((item.settings) || {}), audience_channels: audienceChannels } }
                  : item
              ))
              await actions.trackNodeSave(
                node.id,
                supabase.from('instance_nodes').update({
                  settings: { ...((node.settings) || {}), audience_channels: audienceChannels }
                }).eq('id', node.id),
                "settings"
              )
            }}
          />
        )}

        {node.type === 'publish' && (
          <ImprentaPublishDestinationSelector
            site={currentSite}
            destinations={(node.settings)?.publish_destinations}
            onDestinationsChange={async (publishDestinations) => {
              const settings = {
                ...((node.settings) || {}),
                publish_destinations: publishDestinations,
              }
              actions.setNodes((prev: InstanceNode[]) =>
                prev.map((item: InstanceNode) =>
                  item.id === node.id
                    ? { ...item, settings }
                    : item
                )
              )
              await actions.trackNodeSave(
                node.id,
                supabase
                  .from('instance_nodes')
                  .update({ settings })
                  .eq('id', node.id),
                "settings"
              )
            }}
          />
        )}

        {node.type !== 'publish' && node.type !== 'generate-audience' && (
          <div className="flex justify-start w-full">
            <MediaParametersToolbar
              selectedActivity={node.type}
              textParameters={(node.settings)?.parameters || textParams}
              imageParameters={(node.settings)?.parameters || imageParams}
              videoParameters={(node.settings)?.parameters || videoParams}
              audioParameters={(node.settings)?.parameters || audioParams}
              onTextParameterChange={async (key, value) => {
                const currentParams = (node.settings)?.parameters || textParams;
                const newParams = { ...currentParams, [key]: value };
                const updatedSettings = { ...((node.settings) || {}), media_type: 'text', parameters: newParams };
                actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                await actions.trackNodeSave(
                  node.id,
                  supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id),
                  "settings"
                );
              }}
              onImageParameterChange={async (key, value) => {
                const currentParams = (node.settings)?.parameters || imageParams;
                const newParams = { ...currentParams, [key]: value };
                const updatedSettings = { ...((node.settings) || {}), media_type: 'image', parameters: newParams };
                actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                await actions.trackNodeSave(
                  node.id,
                  supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id),
                  "settings"
                );
              }}
              onVideoParameterChange={async (key, value) => {
                const currentParams = (node.settings)?.parameters || videoParams;
                const newParams = applyVideoParameterChange(currentParams, key, value);
                const updatedSettings = { ...((node.settings) || {}), media_type: 'video', parameters: newParams };
                actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                await actions.trackNodeSave(
                  node.id,
                  supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id),
                  "settings"
                );
              }}
              onAudioParameterChange={async (key, value) => {
                const currentParams = (node.settings)?.parameters || audioParams;
                const newParams = { ...currentParams, [key]: value };
                const updatedSettings = { ...((node.settings) || {}), media_type: 'audio', parameters: newParams };
                actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                await actions.trackNodeSave(
                  node.id,
                  supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id),
                  "settings"
                );
              }}
            />
          </div>
        )}
      </>
    )}</>
}
