"use client"

import { Button } from "@/app/components/ui/button"
import { Dialog,DialogBody,DialogContent,DialogDescription,DialogFooter,DialogForm,DialogHeader,DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/app/components/ui/select"
import { Textarea } from "@/app/components/ui/textarea"
import { useSite } from "@/app/context/SiteContext"
import React,{ useState } from "react"
import { toast } from "sonner"
import { type CopywritingItem } from "./actions"

import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { RelationSelect,RelationSelectValue } from "@/app/components/ui/relation-select"


import { COPYWRITING_TYPES,type CopywritingType } from "./copywriting-presentation"
// Create copywriting dialog
interface CreateCopywritingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Partial<CopywritingItem>) => Promise<void>
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
}

export function CreateCopywritingDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  segments, 
  campaigns 
}: CreateCopywritingDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'tweet' as CopywritingType,
    content: '',
    segment_id: '',
    campaign_id: '',
    segmentValue: null as RelationSelectValue,
    campaignValue: null as RelationSelectValue
  })

  const { currentSite } = useSite()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }
    
    if (!currentSite) {
      toast.error('Site is required')
      return
    }

    try {
      let resolvedSegmentId = null;
      if (formData.segmentValue) {
        const { id, error } = await resolveRelationId("segment", formData.segmentValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedSegmentId = id;
      }

      let resolvedCampaignId = null;
      if (formData.campaignValue) {
        const { id, error } = await resolveRelationId("campaign", formData.campaignValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedCampaignId = id;
      }

      await onSubmit({
        ...formData,
        segment_id: resolvedSegmentId || '',
        campaign_id: resolvedCampaignId || ''
      })
      setFormData({
        title: '',
        description: '',
        type: 'tweet',
        content: '',
        segment_id: '',
        campaign_id: '',
        segmentValue: null,
        campaignValue: null
      })
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error resolving relations')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Copy</DialogTitle>
            <DialogDescription>
              Create a new piece of copywriting content
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter title..."
                required />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: CopywritingType) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COPYWRITING_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="segment">Segment (Optional)</Label>
              <RelationSelect 
                options={segments.map(s => ({ id: s.id, label: s.name }))}
                value={formData.segmentValue} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, segmentValue: value }))}
                placeholder="Select a segment..."
                emptyMessage="No segment found" />
            </div>
            <div>
              <Label htmlFor="campaign">Campaign (Optional)</Label>
              <RelationSelect 
                options={campaigns.map(c => ({ id: c.id, label: c.title }))}
                value={formData.campaignValue} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, campaignValue: value }))}
                placeholder="Select a campaign..."
                emptyMessage="No campaign found" />
            </div>
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your copy here..."
              rows={8} />
          </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Copy
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}

