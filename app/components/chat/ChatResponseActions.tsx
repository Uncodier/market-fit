"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Save,
  ThumbsDown,
  ThumbsUp,
} from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { copyToClipboard } from "@/app/utils/clipboard"
import { markUINavigation } from "@/lib/navigation/navigation-helpers"
import { syncAiFeedbackRecord, type FeedbackRecordInput } from "@/app/records/response-record-actions"
import { SaveResponseAsRecordDialog } from "@/app/components/simple-messages-view/components/SaveResponseAsRecordDialog"

interface ChatResponseActionsProps {
  messageId: string
  commandId?: string
  agentId: string
  siteId?: string
  conversationId?: string
  userPrompt?: string
  response: string
}

type FeedbackKind = "like" | "dislike" | "error"

const LIKE_BIT = 1
const DISLIKE_BIT = 2
const ERROR_BIT = 4

function ratingFromPerformance(value: number): FeedbackRecordInput["rating"] {
  if ((value & ERROR_BIT) === ERROR_BIT) return "Error"
  if ((value & LIKE_BIT) === LIKE_BIT) return "Like"
  if ((value & DISLIKE_BIT) === DISLIKE_BIT) return "Dislike"
  return null
}

function nextPerformance(current: number, kind: FeedbackKind) {
  if (kind === "like") return (current & ~DISLIKE_BIT) | LIKE_BIT
  if (kind === "dislike") return (current & ~LIKE_BIT) | DISLIKE_BIT
  return current ^ ERROR_BIT
}

export function ChatResponseActions({
  messageId,
  commandId,
  agentId,
  siteId,
  conversationId,
  userPrompt,
  response,
}: ChatResponseActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [performance, setPerformance] = useState(0)
  const [copied, setCopied] = useState(false)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)

  useEffect(() => {
    if (!commandId) {
      setPerformance(0)
      return
    }
    let cancelled = false
    const supabase = createClient()
    void supabase.rpc("get_performance_status", { command_id: commandId }).then(({ data, error }: any) => {
      if (cancelled || error || !data?.[0]) return
      let value = 0
      if (data[0].has_like) value |= LIKE_BIT
      if (data[0].has_dislike) value |= DISLIKE_BIT
      if (data[0].has_flag) value |= ERROR_BIT
      setPerformance(value)
    })
    return () => {
      cancelled = true
    }
  }, [commandId])

  const syncRecord = async (value: number) => {
    if (!siteId) return
    const result = await syncAiFeedbackRecord({
      siteId,
      source: "chat",
      sourceId: commandId || `${conversationId || "conversation"}:${messageId}`,
      rating: ratingFromPerformance(value),
      title: userPrompt?.trim() || "AI response",
      response,
      agentId,
      conversationId,
      commandId,
      messageId,
    })
    if (!result.success) toast.error(`Feedback saved, but the reference record failed: ${result.error}`)
  }

  const handleFeedback = async (kind: FeedbackKind) => {
    if (!commandId || isLoading) return
    setIsLoading(true)
    try {
      const supabase = createClient()
      const rpcName = kind === "like" ? "set_like" : kind === "dislike" ? "set_dislike" : "toggle_flag"
      const { error } = await supabase.rpc(rpcName, { command_id: commandId })
      if (error) throw error

      const next = nextPerformance(performance, kind)
      setPerformance(next)
      await syncRecord(next)
      toast.success(kind === "error" ? "Error feedback updated" : `${kind === "like" ? "Like" : "Dislike"} updated`)
    } catch (error) {
      console.error("[ChatResponseActions]", error)
      toast.error("Could not save feedback")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!(await copyToClipboard(response))) {
      toast.error("Copy failed")
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const actions = [
    {
      key: "copy",
      label: copied ? "Copied" : "Copy",
      active: copied,
      onClick: handleCopy,
      icon: copied ? Check : Copy,
    },
    ...(commandId
      ? [
          {
            key: "like",
            label: "Like",
            active: (performance & LIKE_BIT) === LIKE_BIT,
            onClick: () => handleFeedback("like"),
            icon: ThumbsUp,
          },
          {
            key: "dislike",
            label: "Dislike",
            active: (performance & DISLIKE_BIT) === DISLIKE_BIT,
            onClick: () => handleFeedback("dislike"),
            icon: ThumbsDown,
          },
          {
            key: "error",
            label: "Report error",
            active: (performance & ERROR_BIT) === ERROR_BIT,
            onClick: () => handleFeedback("error"),
            icon: AlertTriangle,
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {actions.map(({ key, label, active, onClick, icon: Icon }) => (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void onClick()}
                  disabled={isLoading}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-label={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent><p>{label}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

        {commandId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    markUINavigation()
                    router.push(`/agents/${agentId}/${commandId}`)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Inspect"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent><p>Inspect</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setRecordDialogOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Save as record"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p>Save as record</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <SaveResponseAsRecordDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        userPrompt={userPrompt}
        response={response}
      />
    </>
  )
}
