"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { toast } from "sonner"
import { createContent } from "./actions"
import { useSite } from "@/app/context/SiteContext"
import { 
  Plus, 
  X, 
  Users, 
  Target, 
  Type, 
  Tag, 
  FileText, 
  LayoutGrid 
} from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ContentType, CONTENT_TYPE_NAMES } from "./utils"
import { useLocalization } from "@/app/context/LocalizationContext"

interface Segment {
  id: string
  name: string
  description?: string
}

interface Campaign {
  id: string
  title: string
  description?: string
}

interface CreateContentDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  segments: Segment[]
  campaigns?: Campaign[]
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CreateContentDialog({ 
  isOpen: controlledIsOpen, 
  onOpenChange: controlledOnOpenChange, 
  segments,
  campaigns = [],
  onSuccess,
  trigger
}: CreateContentDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [text, setText] = useState('')
  const [type, setType] = useState<"blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page">('blog_post')
  const [segmentValue, setSegmentValue] = useState<RelationSelectValue>(null)
  const [campaignValue, setCampaignValue] = useState<RelationSelectValue>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const isControlled = controlledIsOpen !== undefined
  const open = isControlled ? controlledIsOpen : isOpen
  const onOpenChange = isControlled ? controlledOnOpenChange : setIsOpen

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) return

    setIsCreating(true)
    try {
      let resolvedSegmentId = null;
      if (segmentValue) {
        const { id, error } = await resolveRelationId("segment", segmentValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedSegmentId = id;
      }

      let resolvedCampaignId = null;
      if (campaignValue) {
        const { id, error } = await resolveRelationId("campaign", campaignValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedCampaignId = id;
      }

      const result = await createContent({
        siteId: currentSite.id,
        title,
        description,
        type,
        segment_id: resolvedSegmentId,
        campaign_id: resolvedCampaignId,
        tags: tags.length > 0 ? tags : null,
        text: text
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Content created successfully")
      // Reset form
      setTitle('')
      setDescription('')
      setText('')
      setType('blog_post')
      setSegmentValue(null)
      setCampaignValue(null)
      setTags([])
      setTagInput('')
      
      if (onOpenChange) onOpenChange(false)
      onSuccess && onSuccess()
    } catch (error) {
      console.error("Error creating content:", error)
      toast.error("Failed to create content")
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }




  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent size="md" busy={isCreating}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Content</DialogTitle>
            <DialogDescription>
              Add a new content item to your content library.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter content title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a brief description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Content Text
              </Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the main content text"
                rows={6}
                className="min-h-[150px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                Content Type
              </Label>
              <Select
                value={type}
                onValueChange={(value: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page") => setType(value)}
              >
                <SelectTrigger id="type" className="h-12">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPE_NAMES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="segment" className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Segment
              </Label>
              <RelationSelect
                options={(Array.isArray(segments) ? segments : []).map(s => ({ id: s.id, label: s.name }))}
                value={segmentValue}
                onValueChange={setSegmentValue}
                placeholder="Select a segment (optional)"
                emptyMessage="No segments found"
                className="h-12"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="campaign">Campaign</Label>
              </div>
              <RelationSelect
                options={(Array.isArray(campaigns) ? campaigns : []).map(c => ({ id: c.id, label: c.title }))}
                value={campaignValue}
                onValueChange={setCampaignValue}
                placeholder="Select a campaign (optional)"
                emptyMessage="No campaigns found"
                className="h-12"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 flex items-center gap-1"
                  >
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                      disabled={isCreating}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add tags..."
                  disabled={isCreating}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || isCreating}
                  className="h-12"
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (t('layout.nav.content.creating') || 'Creating...') : t('layout.nav.content.create') || "Create Content"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
} 