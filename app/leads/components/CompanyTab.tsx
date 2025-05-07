import React from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Globe, Tag, User, ExternalLink } from "@/app/components/ui/icons"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

interface CompanyTabProps {
  lead: Lead
  isEditing: boolean
  editForm: Omit<Lead, "id" | "created_at">
  setEditForm: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "created_at">>>
}

export function CompanyTab({ 
  lead, 
  isEditing, 
  editForm, 
  setEditForm 
}: CompanyTabProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Company Name</p>
          {isEditing ? (
            <Input
              value={editForm.company?.name || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                company: { ...editForm.company, name: e.target.value }
              })}
              className="h-12 text-sm"
              placeholder="Company name"
            />
          ) : (
            <p className="text-sm font-medium">{lead.company?.name || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
          {isEditing ? (
            <textarea
              value={editForm.company?.description || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                company: { ...editForm.company, description: e.target.value }
              })}
              className="h-24 text-sm w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Company description"
            />
          ) : (
            <p className="text-sm font-medium whitespace-pre-wrap">{lead.company?.description || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Website</p>
          {isEditing ? (
            <Input
              value={editForm.company?.website || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                company: { ...editForm.company, website: e.target.value }
              })}
              className="h-12 text-sm"
              placeholder="https://example.com"
            />
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{lead.company?.website || "Not specified"}</p>
              {lead.company?.website && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(lead.company?.website as string, '_blank')}
                  className="h-8 ml-2"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Industry</p>
          {isEditing ? (
            <Select
              value={editForm.company?.industry || "none"}
              onValueChange={(value) => setEditForm({
                ...editForm,
                company: { ...editForm.company, industry: value === "none" ? "" : value }
              })}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="finance">Finance & Banking</SelectItem>
                <SelectItem value="health">Healthcare</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="services">Professional Services</SelectItem>
                <SelectItem value="hospitality">Hospitality</SelectItem>
                <SelectItem value="media">Media & Entertainment</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
                <SelectItem value="logistics">Logistics & Transportation</SelectItem>
                <SelectItem value="nonprofit">Nonprofit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium capitalize">
              {lead.company?.industry?.replace('_', ' ') || "Not specified"}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Company Size</p>
          {isEditing ? (
            <Select
              value={editForm.company?.size || "none"}
              onValueChange={(value) => setEditForm({
                ...editForm,
                company: { ...editForm.company, size: value === "none" ? "" : value }
              })}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="1-10">1-10 employees</SelectItem>
                <SelectItem value="11-50">11-50 employees</SelectItem>
                <SelectItem value="51-200">51-200 employees</SelectItem>
                <SelectItem value="201-500">201-500 employees</SelectItem>
                <SelectItem value="501-1000">501-1000 employees</SelectItem>
                <SelectItem value="1001-5000">1001-5000 employees</SelectItem>
                <SelectItem value="5001-10000">5001-10000 employees</SelectItem>
                <SelectItem value="10001+">10001+ employees</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">
              {lead.company?.size ? `${lead.company.size} employees` : "Not specified"}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Annual Revenue</p>
          {isEditing ? (
            <Select
              value={editForm.company?.annual_revenue || "none"}
              onValueChange={(value) => setEditForm({
                ...editForm,
                company: { ...editForm.company, annual_revenue: value === "none" ? undefined : value }
              })}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select annual revenue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="<1M">Less than $1M</SelectItem>
                <SelectItem value="1M-10M">$1M - $10M</SelectItem>
                <SelectItem value="10M-50M">$10M - $50M</SelectItem>
                <SelectItem value="50M-100M">$50M - $100M</SelectItem>
                <SelectItem value="100M-500M">$100M - $500M</SelectItem>
                <SelectItem value="500M-1B">$500M - $1B</SelectItem>
                <SelectItem value=">1B">More than $1B</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">
              {lead.company?.annual_revenue || "Not specified"}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Founded</p>
          {isEditing ? (
            <Input
              value={editForm.company?.founded || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                company: { ...editForm.company, founded: e.target.value }
              })}
              className="h-12 text-sm"
              placeholder="Year founded"
            />
          ) : (
            <p className="text-sm font-medium">{lead.company?.founded || "Not specified"}</p>
          )}
        </div>
      </div>
      
      {/* Company Address Section */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Company Address</h4>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Street</p>
            {isEditing ? (
              <Input
                value={editForm.company?.address?.street || ""}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  company: { 
                    ...editForm.company, 
                    address: { 
                      ...editForm.company?.address || {}, 
                      street: e.target.value 
                    } 
                  }
                })}
                className="h-12 text-sm"
                placeholder="Street address"
              />
            ) : (
              <p className="text-sm font-medium">{lead.company?.address?.street || "Not specified"}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">City</p>
            {isEditing ? (
              <Input
                value={editForm.company?.address?.city || ""}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  company: { 
                    ...editForm.company, 
                    address: { 
                      ...editForm.company?.address || {}, 
                      city: e.target.value 
                    } 
                  }
                })}
                className="h-12 text-sm"
                placeholder="City"
              />
            ) : (
              <p className="text-sm font-medium">{lead.company?.address?.city || "Not specified"}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">State/Province</p>
            {isEditing ? (
              <Input
                value={editForm.company?.address?.state || ""}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  company: { 
                    ...editForm.company, 
                    address: { 
                      ...editForm.company?.address || {}, 
                      state: e.target.value 
                    } 
                  }
                })}
                className="h-12 text-sm"
                placeholder="State/Province"
              />
            ) : (
              <p className="text-sm font-medium">{lead.company?.address?.state || "Not specified"}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">ZIP/Postal Code</p>
            {isEditing ? (
              <Input
                value={editForm.company?.address?.zipcode || ""}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  company: { 
                    ...editForm.company, 
                    address: { 
                      ...editForm.company?.address || {}, 
                      zipcode: e.target.value 
                    } 
                  }
                })}
                className="h-12 text-sm"
                placeholder="ZIP/Postal Code"
              />
            ) : (
              <p className="text-sm font-medium">{lead.company?.address?.zipcode || "Not specified"}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Country</p>
            {isEditing ? (
              <Input
                value={editForm.company?.address?.country || ""}
                onChange={(e) => setEditForm({
                  ...editForm, 
                  company: { 
                    ...editForm.company, 
                    address: { 
                      ...editForm.company?.address || {}, 
                      country: e.target.value 
                    } 
                  }
                })}
                className="h-12 text-sm"
                placeholder="Country"
              />
            ) : (
              <p className="text-sm font-medium">{lead.company?.address?.country || "Not specified"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 