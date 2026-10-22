import { InstanceNode } from "@/app/types/instance-nodes"
import { normalizeVideoParametersForExecution } from "../../simple-messages-view/media-parameter-normalization"
import { toast } from "sonner"
import { validatePublishNodeInputs } from "@/app/components/agents/imprenta-publish-context"
import { buildPublishRouting, getTestRecipient } from "@/app/components/agents/imprenta-publish-routing"
import { executeImprentaNode } from "@/app/components/agents/imprenta-execution-client"

import type { useImprentaPanelState } from './state'
import type { useImprentaMeasurement } from './measurement'

type ImprentaExecutionOptions = Pick<ReturnType<typeof useImprentaPanelState>, "persistenceBarrier" | "nodesRef" | "videoParams" | "supabase" | "setNodes" | "contexts" | "logs" | "setDummyNodes" | "currentSite"> & Pick<ReturnType<typeof useImprentaMeasurement>, "canvasNodes">

export function useImprentaExecution({ persistenceBarrier, nodesRef, videoParams, supabase, setNodes, contexts, canvasNodes, logs, setDummyNodes, currentSite }: ImprentaExecutionOptions) {
  const handleExecuteNode = async (node: InstanceNode, testDestinations?: Record<string, string>) => {
    try {
      await persistenceBarrier.wait(node.id)
      node = nodesRef.current.find((candidate) => candidate.id === node.id) ?? node
      if (node.type === "generate-video") {
        const currentParameters = (node.settings)?.parameters || videoParams
        const normalizedParameters = normalizeVideoParametersForExecution(currentParameters)
        if (
          normalizedParameters.aspectRatio !== currentParameters.aspectRatio
          || normalizedParameters.duration !== currentParameters.duration
        ) {
          const settings = {
            ...((node.settings) || {}),
            media_type: "video",
            parameters: normalizedParameters,
          }
          await persistenceBarrier.track(
            node.id,
            supabase.from("instance_nodes").update({ settings }).eq("id", node.id),
            "settings"
          )
          await persistenceBarrier.wait(node.id)
          setNodes((previous) => previous.map((candidate) =>
            candidate.id === node.id ? { ...candidate, settings } : candidate))
          node = { ...node, settings }
        }
      }
    } catch (error) {
      console.error("Failed to save node before execution:", error)
      toast.error("Save the latest node changes before executing")
      return
    }

    if (node.type === "publish") {
      if (!testDestinations) {
        const err = validatePublishNodeInputs(node, contexts, canvasNodes, logs)
        if (err) {
          toast.error(err)
          return
        }
      }
    }
    toast.info("Executing node...")
    try {
      // Create a dummy placeholder child node visually
      const expectedAmount = Number((node.settings)?.parameters?.expectedResults) || 1;
      const currentMediaType = (node.settings)?.media_type || (node.type === 'prompt' ? 'text' : node.type.replace('generate-', ''));
      const newDummies = Array.from({ length: expectedAmount }).map((_, i) => ({
        id: `dummy-${Date.now()}-${i}`,
        instance_id: node.instance_id,
        parent_node_id: node.id,
        original_node_id: null,
        parent_instance_log_id: null,
        type: 'Generating...',
        status: 'running',
        prompt: { text: '' },
        settings: {
          media_type: currentMediaType,
          parameters: (node.settings)?.parameters
        },
        result: {},
        site_id: node.site_id,
        user_id: node.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as InstanceNode));

      setDummyNodes(prev => [...prev, ...newDummies])

      // 1. Set the current node to running to show visual feedback immediately
      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'running' } : n));
      await supabase
        .from('instance_nodes')
        .update({ status: 'running' })
        .eq('id', node.id)

      const { getSystemPromptForActivity } = await import('@/app/components/simple-messages-view/utils')

      // Prepare context string with media parameters
      const contextObj: Record<string, unknown> & { parameters: InstanceNode["settings"] } = {
        mediaType: currentMediaType,
        output_type: currentMediaType,
        parameters: { ...((node.settings)?.parameters || {}) }
      };
      let publishRouting: ReturnType<typeof buildPublishRouting> | undefined

      if (node.type === 'publish') {
        const dest = Array.isArray((node.settings)?.publish_destinations)
          ? ((node.settings).publish_destinations as string[])
          : []
        publishRouting = buildPublishRouting(dest, currentSite)
        contextObj.publish_destinations = dest
        contextObj.publish_channels = publishRouting.deliveryChannels
        contextObj.channel_routing = publishRouting.channelRouting
        contextObj.distributionModes = publishRouting.distributionModes
        if (publishRouting.voiceMode) {
          contextObj.publish_voice_mode = publishRouting.voiceMode
        }
      }

      // Remove expectedResults from context to prevent the LLM from duplicating output internally
      if (contextObj.parameters.expectedResults !== undefined) {
        delete contextObj.parameters.expectedResults;
      }

      let toolOverrides: Record<string, InstanceNode["settings"]> | undefined = undefined;

      if (node.type === 'generate-audience') {
        const channels = (node.settings)?.audience_channels || [];
        if (channels.length > 0) {
          toolOverrides = toolOverrides || {};
          toolOverrides.audience = { channels };
        }
      }

      if (node.type === 'publish' && publishRouting) {
        toolOverrides = {}
        if (Object.keys(publishRouting.bulkMessageOverride).length > 0) {
          toolOverrides.sendBulkMessages = publishRouting.bulkMessageOverride
        }
        if (Object.keys(publishRouting.publishOverride).length > 0) {
          toolOverrides.publish = publishRouting.publishOverride
        }
        if (Object.keys(toolOverrides).length === 0) {
          toolOverrides = undefined
        }
      }

      if (testDestinations) {
        contextObj.is_test = true;
        contextObj.test_destination = testDestinations;

        if (node.type === 'publish' && publishRouting) {
          const testRecipient = getTestRecipient(publishRouting.deliveryChannels, testDestinations)
          toolOverrides = toolOverrides || {};
          toolOverrides.sendBulkMessages = {
            ...(toolOverrides.sendBulkMessages || {}),
            is_test: true,
          }
          if (testRecipient) {
            toolOverrides.sendBulkMessages.test_recipient = testRecipient;
          }
        }
      }

      const systemPrompt = getSystemPromptForActivity(node.type, {
        imageParameters: (node.settings)?.parameters,
        videoParameters: (node.settings)?.parameters,
        audioParameters: (node.settings)?.parameters,
      });

      const requestPayload = {
        message: node.prompt?.text || "Execute node",
        site_id: node.site_id,
        user_id: node.user_id,
        instance_id: node.instance_id,
        instance_node_id: node.id, // Pass the current node ID instead of creating a child
        context: JSON.stringify({ ...contextObj, nodeType: node.type }), // Ensure nodeType is sent
        system_prompt: systemPrompt,
        expected_results_amount: (node.settings)?.parameters?.expectedResults || 1,
        ...(toolOverrides ? { tool_overrides: toolOverrides } : {})
      }

      // Route through the web contract proxy so persisted UI state is authoritative.
      const res = await executeImprentaNode(requestPayload)

      const response = res as typeof res & { message?: string }

      if (!response.success) {
        console.error('API Error Response:', response.error);

        // Revert node status on failure
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'failed' } : n));
        await supabase
          .from('instance_nodes')
          .update({ status: 'failed' })
          .eq('id', node.id)

        throw new Error(`Failed to start execution: ${response.error?.message || 'Unknown error'}`);
      }

      toast.success("Execution started asynchronously")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to execute node")
    }
  }

  return { handleExecuteNode }
}
