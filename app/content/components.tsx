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
import { PlusCircle, X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"

interface CreateContentDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  segments: Array<{ id: string; name: string }>
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CreateContentDialog({ 
  isOpen: controlledIsOpen, 
  onOpenChange: controlledOnOpenChange, 
  segments,
  onSuccess,
  trigger
}: CreateContentDialogProps) {
  const { currentSite } = useSite()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content_type, setContentType] = useState<"blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page">('blog_post')
  const [segment_id, setSegmentId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isControlled = controlledIsOpen !== undefined
  const open = isControlled ? controlledIsOpen : isOpen
  const onOpenChange = isControlled ? controlledOnOpenChange : setIsOpen

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) return

    setIsSubmitting(true)
    try {
      const result = await createContent({
        siteId: currentSite.id,
        title,
        description,
        content_type,
        segment_id,
        tags: tags.length > 0 ? tags : null,
        content
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Content created successfully")
      onOpenChange(false)
      onSuccess && onSuccess()
    } catch (error) {
      console.error("Error creating content:", error)
      toast.error("Failed to create content")
    } finally {
      setIsSubmitting(false)
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
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter content title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a brief description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter content in markdown format"
                rows={10}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content_type">Content Type</Label>
              <Select
                value={content_type}
                onValueChange={(value: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page") => setContentType(value)}
              >
                <SelectTrigger id="content_type">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog_post">Blog Post</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="social_post">Social Media Post</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="case_study">Case Study</SelectItem>
                  <SelectItem value="whitepaper">Whitepaper</SelectItem>
                  <SelectItem value="infographic">Infographic</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="ebook">E-Book</SelectItem>
                  <SelectItem value="ad">Advertisement</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="segment">Segment</Label>
              <Select
                value={segment_id || ''}
                onValueChange={(value) => setSegmentId(value === '' ? null : value)}
              >
                <SelectTrigger id="segment">
                  <SelectValue placeholder="Select segment (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No segment</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
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
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add tags..."
                  disabled={isSubmitting}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || isSubmitting}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Content"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 