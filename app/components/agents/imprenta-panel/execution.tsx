import { InstanceNode } from "@/app/types/instance-nodes"
import { normalizeVideoParametersForExecution } from "../../simple-messages-view/media-parameter-normalization"
import { toast } from "sonner"
import { validatePublishNodeInputs } from "@/app/components/agents/imprenta-publish-context"
import { buildPublishRouting, getTestRecipient } from "@/app/components/agents/imprenta-publish-routing"
import { executeImprentaNode } from "@/app/components/agents/imprenta-execution-client"
import { useLayoutEffect, useMemo, useRef } from "react"

import type { useImprentaPanelState } from './state'
import type { useImprentaMeasurement } from './measurement'

type ImprentaExecutionOptions = Pick<ReturnType<typeof useImprentaPanelState>, "persistenceBarrier" | "nodesRef" | "videoParams" | "supabase" | "setNodes" | "contexts" | "setDummyNodes" | "currentSite" | "activeInstanceId" | "isGraphReady" | "ensureImprentaLogs"> & Pick<ReturnType<typeof useImprentaMeasurement>, "canvasNodes">

export function useImprentaExecution({ persistenceBarrier, nodesRef, videoParams, supabase, setNodes, contexts, canvasNodes, setDummyNodes, currentSite, activeInstanceId, isGraphReady, ensureImprentaLogs }: ImprentaExecutionOptions) {
  const siteId = currentSite?.id
  const scope = useMemo(() => ({ instanceId: activeInstanceId, siteId }), [activeInstanceId, siteId])
  const activeScope = useRef<object | null>(scope)
  const executions = useRef(new Map<string, object>())
  const latest = useRef({ isGraphReady, contexts, canvasNodes })
  useLayoutEffect(() => {
    latest.current = { isGraphReady, contexts, canvasNodes }
  }, [isGraphReady, contexts, canvasNodes])
  useLayoutEffect(() => {
    activeScope.current = scope
    return () => { activeScope.current = null }
  }, [scope])

  const handleExecuteNode = async (node: InstanceNode, testDestinations?: Record<string, string>) => {
    const isCurrent = () => activeScope.current === scope
      && node.instance_id === activeInstanceId && node.site_id === currentSite?.id
    const requireCurrentGraph = (refreshNode = true) => {
      if (!isCurrent() || !latest.current.isGraphReady) {
        throw new Error("Load the current canvas and its connections before executing")
      }
      const currentNode = nodesRef.current.find(candidate => candidate.id === node.id)
      if (!currentNode || currentNode.instance_id !== activeInstanceId || currentNode.site_id !== siteId) {
        throw new Error("This node is no longer available in the current canvas")
      }
      if (refreshNode) node = currentNode
    }
    try {
      requireCurrentGraph()
      await persistenceBarrier.wait(node.id)
      requireCurrentGraph()
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
          requireCurrentGraph()
          setNodes((previous) => previous.map((candidate) =>
            candidate.id === node.id ? { ...candidate, settings } : candidate))
          node = { ...node, settings }
        }
      }
    } catch (error) {
      console.error("Failed to save node before execution:", error)
      toast.error("Load the current canvas and save the latest changes before executing")
      return
    }

    if (node.type === "publish") {
      try {
        // Display logs can be stale or server-limited. Test publishes also need
        // a fresh, complete read; neither path may substitute an empty array.
        const currentLogs = await ensureImprentaLogs()
        await persistenceBarrier.wait(node.id)
        requireCurrentGraph()
        if (!testDestinations) {
          const err = validatePublishNodeInputs(node, latest.current.contexts, latest.current.canvasNodes, currentLogs)
          if (err) {
            toast.error(err)
            return
          }
        }
      } catch (error) {
        console.error("Failed to load required publish data:", error)
        toast.error("Load the current canvas logs and connections before publishing")
        return
      }
    }
    const attempt = {}
    let admitted = false
    const ownsExecution = () => executions.current.get(node.id) === attempt
    const canUpdateUI = () => isCurrent() && ownsExecution()
    try {
      const { getSystemPromptForActivity } = await import('@/app/components/simple-messages-view/utils')
      requireCurrentGraph(false)
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

      executions.current.set(node.id, attempt)
      admitted = true
      toast.info("Executing node...")
      setDummyNodes(prev => isCurrent() ? [...prev, ...newDummies] : prev)
      setNodes(prev => isCurrent()
        ? prev.map(n => n.id === node.id ? { ...n, status: 'running' } : n) : prev)

      // After admission, navigation only retires UI updates, not the durable
      // handoff. Capture the written version for conditional rejection cleanup.
      const { data: running, error: runningError } = await supabase
        .from('instance_nodes')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', node.id)
        .select('updated_at')
        .single()

      // Route through the web contract proxy so persisted UI state is authoritative.
      const response = await executeImprentaNode(requestPayload)

      if (!response.success) {
        console.error('API Error Response:', response.error);

        // The client wraps the proxy body in error.details. Transport/gateway
        // failures are uncertain, and a conflict may belong to another run.
        const details = response.error?.details as { execution_started?: boolean } | undefined
        const rejected = details?.execution_started !== true && response.status !== 409 && (
          details?.execution_started === false || [400, 401, 402, 403, 404, 413, 422, 429].includes(response.status ?? 0)
        )
        if (rejected && ownsExecution() && !runningError && running?.updated_at) {
          const { data: failed, error } = await supabase
            .from('instance_nodes')
            .update({ status: 'failed' })
            .eq('id', node.id)
            .eq('status', 'running')
            .eq('updated_at', running.updated_at)
            .select('id')
            .maybeSingle()
          if (!error && failed && canUpdateUI()) {
            setNodes(prev => isCurrent() ? prev.map(n => n.id === node.id && n.status === 'running'
              && (n.updated_at === node.updated_at || n.updated_at === running.updated_at)
              ? { ...n, status: 'failed' } : n) : prev)
          }
        }

        throw new Error(rejected
          ? `Failed to start execution: ${response.error?.message || 'Unknown error'}`
          : 'Execution could not be confirmed. Check its status before trying again.');
      }

      if (canUpdateUI()) toast.success("Execution started asynchronously")
    } catch (e) {
      console.error(e)
      if (isCurrent() && (!admitted || ownsExecution())) toast.error(e instanceof Error ? e.message : "Failed to execute node")
    } finally {
      if (ownsExecution()) executions.current.delete(node.id)
    }
  }

  return { handleExecuteNode }
}
