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
import { PlusCircle } from "@/app/components/ui/icons"

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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contentType, setContentType] = useState<string>('blog_post')
  const [segmentId, setSegmentId] = useState<string>('none')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false)
  
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : uncontrolledIsOpen
  const onOpenChange = controlledOnOpenChange || setUncontrolledIsOpen

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!currentSite?.id) {
      toast.error("No site selected")
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const result = await createContent({
        title,
        description: description || undefined,
        content_type: contentType as any,
        segment_id: segmentId === 'none' ? undefined : segmentId,
        site_id: currentSite.id
      })

      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Reset form
      setTitle('')
      setDescription('')
      setContentType('blog_post')
      setSegmentId('none')
      
      toast.success("Content created successfully")
      onOpenChange(false)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error creating content:', error)
      toast.error("Failed to create content")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="content-type">Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger id="content-type">
                    <SelectValue placeholder="Select type" />
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
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger id="segment">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No segment</SelectItem>
                    {segments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Content'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 