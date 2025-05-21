"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { SaveIcon } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { Campaign, CampaignType, CampaignStatus, CampaignPriority } from "@/app/types"

interface CampaignDetailsProps {
  campaign: Campaign;
  onUpdateCampaign: (updatedCampaign: Campaign) => void;
}

export function CampaignDetails({ campaign, onUpdateCampaign }: CampaignDetailsProps) {
  const [formData, setFormData] = useState({
    title: campaign.title,
    description: campaign.description || "",
    type: campaign.type || "inbound" as CampaignType,
    status: campaign.status as CampaignStatus,
    priority: (campaign.priority || "medium") as CampaignPriority
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Update campaign with form data
      const updatedCampaign = {
        ...campaign,
        ...formData
      }
      
      onUpdateCampaign(updatedCampaign)
      toast.success("Campaign updated successfully")
    } catch (error) {
      console.error('Error updating campaign:', error)
      toast.error("Failed to update campaign")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Edit the basic details of your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter campaign title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter campaign description"
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: CampaignType) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="branding">Branding</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="guerrilla">Guerrilla</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
                <SelectItem value="experiential">Experiential</SelectItem>
                <SelectItem value="programmatic">Programmatic</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="publicRelations">Public Relations</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status and Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Status and Priority</CardTitle>
          <CardDescription>
            Update the current status and priority of your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: CampaignStatus) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value: CampaignPriority) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" className="gap-2">
          <SaveIcon className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </form>
  )
} 