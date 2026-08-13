"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Globe } from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { isSocialMediaEntryConnected } from "@/app/components/settings/data-adapter"
import { getNetworkIcon } from "../content-shared"
import { publishOutstandPost } from "../outstand"
import { updateContent, type ContentItem } from "../actions"
import { toast } from "sonner"

interface ContentPublishDialogProps {
  content: ContentItem | null
  socialMedia: any[]
  siteId?: string
  onClose: () => void
  onPublished: () => void
  onUpdateStatus: (contentId: string, status: string) => Promise<void>
}

export function ContentPublishDialog({
  content: publishingContent,
  socialMedia,
  siteId,
  onClose,
  onPublished,
  onUpdateStatus,
}: ContentPublishDialogProps) {
  const router = useRouter()
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date())

  useEffect(() => {
    if (!publishingContent) {
      setSelectedNetworks([])
      return
    }
    const defaultIds = Array.from(new Set(socialMedia.flatMap((s) => {
      if (s.connectedPages && Array.isArray(s.connectedPages) && s.connectedPages.length > 0) {
        return s.connectedPages.map((page: any) => page.id)
      }
      return s.account_id || s.accountId || s.id || null
    }).filter(Boolean)))
    setSelectedNetworks(defaultIds)
  }, [publishingContent, socialMedia])

  const closePublishModal = onClose
  const submitPublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publishingContent || !siteId) return
    if (selectedNetworks.length === 0) {
      toast.error("Please select at least one social network")
      return
    }
    
    try {
      // Map selected IDs back to platform names for saving tags
      const platformNames = selectedNetworks.map(id => {
        const acc = socialMedia.find((s: any) => (s.account_id || s.accountId || s.id || s.platform) === id || (s.connectedPages && s.connectedPages.some((p:any) => p.id === id)));
        return acc ? acc.platform : id;
      });

      // Map selected IDs to account names or usernames for the API as expected by Outstand
      // Use Set to remove duplicates
      const validAccounts = Array.from(new Set(selectedNetworks.map(id => {
        for (const social of socialMedia) {
          if (social.connectedPages && Array.isArray(social.connectedPages)) {
            const page = social.connectedPages.find((p: any) => p.id === id);
            if (page) return page.name || page.username;
          }
          if ((social.account_id || social.accountId || social.id || social.platform) === id) {
            return social.accountName || social.username || id;
          }
        }
        return id;
      }))).filter(n => 
        !['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'github', 'reddit', 'medium', 'x'].includes(n.toLowerCase())
      );

      if (validAccounts.length === 0) {
        toast.error("Please select at least one valid connected account. Check your social media settings.")
        return
      }

      console.log('Publishing to selected network IDs:', selectedNetworks);
      console.log('Filtered valid accounts for API:', validAccounts);
      console.log('Available social media settings:', socialMedia);
      
      const isLinkedInSelected = platformNames.some(p => p.toLowerCase().includes('linkedin'));
      const isFacebookSelected = platformNames.some(p => p.toLowerCase().includes('facebook'));
      const isTwitterSelected = platformNames.some(p => p.toLowerCase().includes('twitter') || p.toLowerCase().includes('x'));
      const isInstagramSelected = platformNames.some(p => p.toLowerCase().includes('instagram'));
      
      // Determine what text to send based on the platform.
      // Usually social networks expect one plain text body.
      // If we have text/content, use it, otherwise fall back to title + description.
      let postContent = '';
      const fullText = publishingContent.text || publishingContent.content || '';
      
      if (fullText && fullText.trim().length > 0) {
        // We have full text, which is likely the actual post body
        postContent = fullText;
      } else {
        // Fallback to title and description
        postContent = publishingContent.title;
        if (publishingContent.description) {
          postContent += `\n\n${publishingContent.description}`;
        }
      }

      // Twitter character limit safeguard
      if (isTwitterSelected && postContent.length > 280) {
        postContent = postContent.substring(0, 277) + '...';
      }

      const payload = {
        tenant_id: siteId,
        containers: [
          {
            content: postContent,
            media: []
          }
        ],
        accounts: validAccounts,
        ...(scheduleEnabled && scheduledDate ? { scheduledAt: scheduledDate.toISOString() } : {})
      }
      
      // Close the modal early for better UX
      onClose()
      
      const { success, data, error } = await publishOutstandPost(siteId, payload)
      
      if (success) {
        toast.success("Content published successfully")
        
        // Save the published info back to the content using platform names
        const newPostId = data?.post?.id || data?.data?.id || data?.id;
        const newTags = Array.from(new Set([...(publishingContent.tags || []), ...platformNames.map(n => `published_${n}`)]));
        if (newPostId) {
          newTags.push(`outstand_id_${newPostId}`);
        }
        
        // Push platformPostIds to tags so we can track the exact publish links if needed
        const accountsData = data?.post?.socialAccounts || data?.data?.socialAccounts || data?.socialAccounts || [];
        accountsData.forEach((acc: any) => {
          if (acc.platformPostId) {
            newTags.push(`platform_post_id_${acc.platformPostId}`);
          }
        });

        await updateContent({
          contentId: publishingContent.id,
          title: publishingContent.title,
          type: publishingContent.type,
          tags: newTags
        });
        
        // Also update status to published
        await onUpdateStatus(publishingContent.id, 'published')
        
        // Refresh the posts list
        onPublished()
      } else {
        throw new Error(error || "Failed to publish")
      }
    } catch (error) {
      console.error(error)
      // Hide any mention of Outstand in error message
      const errMsg = error instanceof Error ? error.message : "Failed to publish content";
      const cleanErrMsg = errMsg.replace(/outstand/i, 'Social Media API').replace(/API Error/i, 'Error');
      toast.error(cleanErrMsg)
    }
  }

  if (!publishingContent) return null
  return (
        <Dialog open={!!publishingContent} onOpenChange={(open) => !open && closePublishModal()}>
          <DialogContent size="sm">
            <DialogForm onSubmit={submitPublish}>
            <DialogHeader>
              <DialogTitle>Publish to Social Media</DialogTitle>
              <DialogDescription>
                Publish &quot;{publishingContent.title}&quot; to your connected social media accounts.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
            {socialMedia.length === 0 ? (
              <EmptyCard
                icon={<Globe className="h-10 w-10 text-muted-foreground" />}
                title="No social accounts connected"
                description="Connect your social media accounts in settings to start publishing content directly from here."
                actionButton={
                  <Button 
                    type="button" 
                    variant="default" 
                    onClick={() => router.push('/settings/social_network')}
                    className="mt-2"
                  >
                    Connect Accounts
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4 pt-4">
                <p className="text-sm font-medium">Select Networks:</p>
                <div className="space-y-2">
                  {socialMedia.map((social, idx) => {
                    const publishReady = isSocialMediaEntryConnected(social)
                    const publishChip = publishReady ? (
                      <Badge variant="secondary" className="text-[10px] font-medium shrink-0 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">
                        Publish ready
                      </Badge>
                    ) : null;
                    // Si tiene connectedPages, mostramos un checkbox por cada una
                    if (social.connectedPages && Array.isArray(social.connectedPages) && social.connectedPages.length > 0) {
                      return social.connectedPages.map((page: any, pageIdx: number) => {
                        // Unique ID combining platform and page ID to avoid duplicates
                        const uniqueId = `${social.platform}-${page.id}`;
                        return (
                        <div key={`${idx}-${pageIdx}`} className="flex items-center space-x-2">
                          <Switch 
                            id={`social-${uniqueId}`} 
                            checked={selectedNetworks.includes(page.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedNetworks(prev => [...prev, page.id])
                              } else {
                                setSelectedNetworks(prev => prev.filter(p => p !== page.id))
                              }
                            }}
                          />
                          <label 
                            htmlFor={`social-${uniqueId}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize flex items-center gap-2 flex-wrap"
                          >
                            {getNetworkIcon(social.platform)}
                            <span className="truncate">{page.name || social.accountName || social.platform}</span>
                            {publishChip}
                          </label>
                        </div>
                      );
                    });
                  }

                  const networkId = social.account_id || social.accountId || social.id || social.platform;
                    return (
                    <div key={idx} className="flex items-center space-x-2">
                      <Switch 
                        id={`social-${networkId}`} 
                        checked={selectedNetworks.includes(networkId)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedNetworks(prev => [...prev, networkId])
                          } else {
                            setSelectedNetworks(prev => prev.filter(p => p !== networkId))
                          }
                        }}
                      />
                      <label 
                        htmlFor={`social-${networkId}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize flex items-center gap-2 flex-wrap"
                      >
                        {getNetworkIcon(social.platform)}
                        <span className="truncate">{social.accountName || social.platform}</span>
                        {publishChip}
                      </label>
                    </div>
                  );
                })}
              </div>
                
                <div className="pt-4 border-t mt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="schedule-post"
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                    />
                    <label htmlFor="schedule-post" className="text-sm font-medium">
                      Schedule post for later
                    </label>
                  </div>
                  
                  {scheduleEnabled && (
                    <div className="grid gap-2 mt-4">
                      <label className="text-xs text-muted-foreground">
                        Select date and time
                      </label>
                      <DatePicker
                        date={scheduledDate}
                        setDate={setScheduledDate}
                        showTimePicker={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePublishModal}>Cancel</Button>
              <Button type="submit" disabled={socialMedia.length === 0 || selectedNetworks.length === 0}>
                {scheduleEnabled && scheduledDate ? "Schedule" : "Publish Now"}
              </Button>
            </DialogFooter>
            </DialogForm>
        </DialogContent>
      </Dialog>
    )
}
