import React from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { 
  User, 
  MessageSquare, 
  Phone, 
  Globe, 
  Tag, 
  FileText, 
  ExternalLink
} from "@/app/components/ui/icons"
import { Target } from "@/app/components/ui/target-icon"
import { CalendarDays } from "./custom-icons"
import { Lead, Segment } from "@/app/leads/types"
import { Campaign } from "@/app/types"

interface DetailsTabProps {
  lead: Lead
  segments: Segment[]
  campaigns: Campaign[]
  isEditing: boolean
  editForm: Omit<Lead, "id" | "created_at">
  setEditForm: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "created_at">>>
  getSegmentName: (segmentId: string | null) => string
  getCampaignName: (campaignId: string | null) => string
  getLanguageName: (languageCode: string | null) => string | null
}

export function DetailsTab({ 
  lead, 
  segments, 
  campaigns, 
  isEditing, 
  editForm, 
  setEditForm,
  getSegmentName,
  getCampaignName,
  getLanguageName
}: DetailsTabProps) {
  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Name</p>
          {isEditing ? (
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              className="h-12 text-sm"
              placeholder="Lead name"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.name}>{lead.name}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Email</p>
          {isEditing ? (
            <Input
              value={editForm.email}
              onChange={(e) => setEditForm({...editForm, email: e.target.value})}
              className="h-12 text-sm"
              placeholder="email@example.com"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.email}>{lead.email}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                className="h-8 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Phone</p>
          {isEditing ? (
            <Input
              value={editForm.phone || ""}
              onChange={(e) => setEditForm({...editForm, phone: e.target.value || null})}
              className="h-12 text-sm"
              placeholder="Phone number"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.phone || "Not specified"}>{lead.phone || "Not specified"}</p>
              {lead.phone && (
                <div className="flex space-x-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`tel:${lead.phone}`)
                    }}
                    className="h-8"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`sms:${lead.phone}`)
                    }}
                    className="h-8"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Birthday</p>
          {isEditing ? (
            <Input
              type="date"
              value={editForm.birthday || ""}
              onChange={(e) => setEditForm({...editForm, birthday: e.target.value || null})}
              className="h-12 text-sm"
              placeholder="Birthday"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.birthday ? new Date(lead.birthday).toLocaleDateString() : "Not specified"}>
              {lead.birthday ? new Date(lead.birthday).toLocaleDateString() : "Not specified"}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Language</p>
          {isEditing ? (
            <Select 
              value={editForm.language || "none"}
              onValueChange={(value) => setEditForm({...editForm, language: value === "none" ? null : value})}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium truncate" title={getLanguageName(lead.language) || "Not specified"}>
              {getLanguageName(lead.language) || "Not specified"}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Position</p>
          {isEditing ? (
            <Input
              value={editForm.position || ""}
              onChange={(e) => setEditForm({...editForm, position: e.target.value || null})}
              className="h-12 text-sm"
              placeholder="Position or role"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.position || "Not specified"}>{lead.position || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Segment</p>
          {isEditing ? (
            <Select 
              value={editForm.segment_id || "none"}
              onValueChange={(value) => setEditForm({...editForm, segment_id: value === "none" ? null : value})}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {segments.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium truncate" title={getSegmentName(lead.segment_id)}>{getSegmentName(lead.segment_id)}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Campaign</p>
          {isEditing ? (
            <Select 
              value={editForm.campaign_id || "none"}
              onValueChange={(value) => setEditForm({...editForm, campaign_id: value === "none" ? null : value})}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium truncate" title={getCampaignName(lead.campaign_id)}>{getCampaignName(lead.campaign_id)}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Origin</p>
          {isEditing ? (
            <Input
              value={editForm.origin || ""}
              onChange={(e) => setEditForm({...editForm, origin: e.target.value || null})}
              className="h-12 text-sm"
              placeholder="Lead origin"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.origin || "Not specified"}>{lead.origin || "Not specified"}</p>
          )}
        </div>
      </div>
    </div>
  )
} 