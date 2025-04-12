"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
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
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<"blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page">('blog_post')
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
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
      const result = await createContent({
        siteId: currentSite.id,
        title,
        description,
        type,
        segment_id: selectedSegment,
        campaign_id: selectedCampaign,
        tags: tags.length > 0 ? tags : null
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Content created successfully")
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

  // Function to toggle segment selection
  const toggleSegment = (segmentId: string) => {
    setSelectedSegment(prevSelected => prevSelected === segmentId ? null : segmentId);
  }

  // Function to toggle campaign selection
  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaign(prevSelected => prevSelected === campaignId ? null : campaignId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Content</DialogTitle>
          <DialogDescription>
            Add a new content item to your content library.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="segment">Segment</Label>
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-4">
                  {segments.map((segment) => {
                    const isSelected = selectedSegment === segment.id;
                    
                    return (
                      <div 
                        key={segment.id} 
                        className={cn(
                          "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                          "transition-colors hover:bg-muted/50"
                        )}
                      >
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={`segment-${segment.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {segment.name}
                          </label>
                          <p className="text-sm text-muted-foreground">
                            {segment.description || "No description available"}
                          </p>
                        </div>
                        <Switch
                          id={`segment-${segment.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleSegment(segment.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {campaigns.length > 0 && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="campaign">Campaign</Label>
                </div>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-4">
                    {campaigns.map((campaign) => {
                      const isSelected = selectedCampaign === campaign.id;
                      
                      return (
                        <div 
                          key={campaign.id} 
                          className={cn(
                            "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                            "transition-colors hover:bg-muted/50"
                          )}
                        >
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`campaign-${campaign.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {campaign.title}
                            </label>
                            <p className="text-sm text-muted-foreground">
                              {campaign.description || "No description available"}
                            </p>
                          </div>
                          <Switch
                            id={`campaign-${campaign.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleCampaign(campaign.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Content"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 