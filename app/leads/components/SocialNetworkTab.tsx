import React from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { ExternalLink } from "@/app/components/ui/icons"
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram,
  TikTok,
  YouTube,
  WhatsApp,
  Pinterest
} from "./custom-icons"
import { Lead } from "@/app/leads/types"

interface SocialNetworkTabProps {
  lead: Lead
  isEditing: boolean
  editForm: Omit<Lead, "id" | "created_at">
  setEditForm: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "created_at">>>
}

export function SocialNetworkTab({ 
  lead, 
  isEditing, 
  editForm, 
  setEditForm 
}: SocialNetworkTabProps) {
  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Linkedin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">LinkedIn</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.linkedin || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  linkedin: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="LinkedIn profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.linkedin || "Not specified"}>{lead.social_networks?.linkedin || "Not specified"}</p>
              {lead.social_networks?.linkedin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.linkedin as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Twitter className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Twitter</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.twitter || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  twitter: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Twitter profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.twitter || "Not specified"}>{lead.social_networks?.twitter || "Not specified"}</p>
              {lead.social_networks?.twitter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.twitter as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Facebook className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Facebook</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.facebook || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  facebook: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Facebook profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.facebook || "Not specified"}>{lead.social_networks?.facebook || "Not specified"}</p>
              {lead.social_networks?.facebook && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.facebook as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Instagram className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Instagram</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.instagram || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  instagram: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Instagram profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.instagram || "Not specified"}>{lead.social_networks?.instagram || "Not specified"}</p>
              {lead.social_networks?.instagram && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.instagram as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <TikTok className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">TikTok</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.tiktok || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  tiktok: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="TikTok profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.tiktok || "Not specified"}>{lead.social_networks?.tiktok || "Not specified"}</p>
              {lead.social_networks?.tiktok && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.tiktok as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <YouTube className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">YouTube</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.youtube || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  youtube: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="YouTube channel URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.youtube || "Not specified"}>{lead.social_networks?.youtube || "Not specified"}</p>
              {lead.social_networks?.youtube && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.youtube as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <WhatsApp className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">WhatsApp</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.whatsapp || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  whatsapp: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="WhatsApp number with country code"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.whatsapp || "Not specified"}>{lead.social_networks?.whatsapp || "Not specified"}</p>
              {lead.social_networks?.whatsapp && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://wa.me/${lead.social_networks?.whatsapp?.replace(/\D/g, '')}`, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Pinterest className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Pinterest</p>
          {isEditing ? (
            <Input
              value={editForm.social_networks?.pinterest || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                social_networks: { 
                  ...editForm.social_networks, 
                  pinterest: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Pinterest profile URL"
            />
          ) : (
            <div className="flex items-center justify-between min-w-0">
              <p className="text-sm font-medium truncate flex-1 mr-2" title={lead.social_networks?.pinterest || "Not specified"}>{lead.social_networks?.pinterest || "Not specified"}</p>
              {lead.social_networks?.pinterest && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.social_networks?.pinterest as string, '_blank')}
                  className="h-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 