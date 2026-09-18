"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import {
  updateContent,
  updateContentStatus,
  type ContentItem,
} from "../../actions"
import { publishOutstandPost } from "../../outstand"

const PLATFORM_NAMES = [
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "github",
  "reddit",
  "medium",
  "x",
  "threads",
  "bluesky",
]

export function useContentPublishing(
  content: any,
  loadContent: () => Promise<void>,
) {
  const { currentSite, getSettings } = useSite()
  const [publishingContent, setPublishingContent] = useState<ContentItem | null>(null)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(new Date())
  const [socialMedia, setSocialMedia] = useState<any[]>([])

  useEffect(() => {
    async function loadSocialMedia() {
      if (!currentSite?.id) return
      try {
        const settings = await getSettings(currentSite.id)
        const entries = Array.isArray(settings?.social_media) ? settings.social_media : []
        const allowedPlatforms = [
          "facebook", "linkedin", "tiktok", "twitter", "x", "instagram",
          "youtube", "threads", "pinterest", "bluesky",
        ]
        setSocialMedia(entries.filter(
          (entry: any) =>
            entry.isActive &&
            allowedPlatforms.includes(entry.platform?.toLowerCase()),
        ))
      } catch (error) {
        console.error("Error loading social media settings:", error)
      }
    }
    void loadSocialMedia()
  }, [currentSite?.id])

  useEffect(() => {
    const openPublishDialog = () => {
      setPublishingContent(content)
      const accountIds = socialMedia.flatMap((entry) => {
        if (Array.isArray(entry.connectedPages) && entry.connectedPages.length > 0) {
          return entry.connectedPages.map((page: any) => page.id)
        }
        return entry.account_id || entry.accountId || entry.id || null
      }).filter(Boolean)
      setSelectedNetworks(Array.from(new Set(accountIds)) as string[])
    }
    window.addEventListener("content:publish", openPublishDialog)
    return () => window.removeEventListener("content:publish", openPublishDialog)
  }, [content, socialMedia])

  const closePublishDialog = () => {
    setPublishingContent(null)
    setSelectedNetworks([])
  }

  const submitPublish = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!publishingContent || !currentSite?.id) return
    if (selectedNetworks.length === 0) {
      toast.error("Please select at least one social network")
      return
    }

    try {
      const platformNames = selectedNetworks.map((id) => {
        const account = socialMedia.find((entry) =>
          (entry.account_id || entry.accountId || entry.id || entry.platform) === id ||
          entry.connectedPages?.some((page: any) => page.id === id))
        return account ? account.platform : id
      })
      const validAccounts = Array.from(new Set(selectedNetworks.map((id) => {
        for (const social of socialMedia) {
          const page = social.connectedPages?.find((entry: any) => entry.id === id)
          if (page) return page.name || page.username
          if ((social.account_id || social.accountId || social.id || social.platform) === id) {
            return social.accountName || social.username || id
          }
        }
        return id
      }))).filter((name) => !PLATFORM_NAMES.includes(name.toLowerCase()))

      if (validAccounts.length === 0) {
        toast.error("Please select at least one valid connected account. Check your social media settings.")
        return
      }

      const isTwitterSelected = platformNames.some((platform) =>
        ["twitter", "x"].some((name) => platform.toLowerCase().includes(name)))
      const fullText = publishingContent.text || publishingContent.content || ""
      let postContent = fullText.trim()
        ? fullText
        : `${publishingContent.title}${publishingContent.description ? `\n\n${publishingContent.description}` : ""}`
      if (isTwitterSelected && postContent.length > 280) {
        postContent = `${postContent.substring(0, 277)}...`
      }

      const payload = {
        tenant_id: currentSite.id,
        containers: [{ content: postContent, media: [] }],
        accounts: validAccounts,
        ...(scheduleEnabled && scheduledDate
          ? { scheduledAt: scheduledDate.toISOString() }
          : {}),
      }
      closePublishDialog()
      const result = await publishOutstandPost(currentSite.id, payload) as any
      if (!result.success) throw new Error(result.error || "Failed to publish")

      toast.success("Content published successfully")
      const data = result.data
      const postId = data?.post?.id || data?.data?.id || data?.id
      const tags = Array.from(new Set([
        ...(publishingContent.tags || []),
        ...platformNames.map((platform) => `published_${platform}`),
      ]))
      if (postId) tags.push(`outstand_id_${postId}`)
      const accountsData =
        data?.post?.socialAccounts ||
        data?.data?.socialAccounts ||
        data?.socialAccounts ||
        []
      accountsData.forEach((account: any) => {
        if (account.platformPostId) tags.push(`platform_post_id_${account.platformPostId}`)
      })

      await updateContent({
        contentId: publishingContent.id,
        title: publishingContent.title,
        type: publishingContent.type as any,
        tags,
      })
      await updateContentStatus({
        contentId: publishingContent.id,
        status: "published",
      })
      await loadContent()
    } catch (error) {
      console.error("Error publishing content:", error)
      const message = error instanceof Error ? error.message : "Failed to publish content"
      toast.error(message.replace(/outstand/i, "Social Media API").replace(/API Error/i, "Error"))
    }
  }

  return {
    currentSite,
    publishingContent,
    socialMedia,
    selectedNetworks,
    setSelectedNetworks,
    scheduleEnabled,
    setScheduleEnabled,
    scheduledDate,
    setScheduledDate,
    closePublishDialog,
    submitPublish,
  }
}
