import React from "react"
import { Input } from "@/app/components/ui/input"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"

interface AddressTabProps {
  lead: Lead
  isEditing: boolean
  editForm: Omit<Lead, "id" | "created_at">
  setEditForm: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "created_at">>>
}

export function AddressTab({ 
  lead, 
  isEditing, 
  editForm, 
  setEditForm 
}: AddressTabProps) {
  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Street</p>
          {isEditing ? (
            <Input
              value={editForm.address?.street || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                address: { 
                  ...editForm.address, 
                  street: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Street address"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.address?.street || "Not specified"}>{lead.address?.street || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">City</p>
          {isEditing ? (
            <Input
              value={editForm.address?.city || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                address: { 
                  ...editForm.address, 
                  city: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="City"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.address?.city || "Not specified"}>{lead.address?.city || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">State</p>
          {isEditing ? (
            <Input
              value={editForm.address?.state || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                address: { 
                  ...editForm.address, 
                  state: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="State/Province"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.address?.state || "Not specified"}>{lead.address?.state || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">ZIP Code</p>
          {isEditing ? (
            <Input
              value={editForm.address?.zipcode || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                address: { 
                  ...editForm.address, 
                  zipcode: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="ZIP/Postal Code"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.address?.zipcode || "Not specified"}>{lead.address?.zipcode || "Not specified"}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Country</p>
          {isEditing ? (
            <Input
              value={editForm.address?.country || ""}
              onChange={(e) => setEditForm({
                ...editForm, 
                address: { 
                  ...editForm.address, 
                  country: e.target.value
                }
              })}
              className="h-12 text-sm"
              placeholder="Country"
            />
          ) : (
            <p className="text-sm font-medium truncate" title={lead.address?.country || "Not specified"}>{lead.address?.country || "Not specified"}</p>
          )}
        </div>
      </div>
    </div>
  )
} 