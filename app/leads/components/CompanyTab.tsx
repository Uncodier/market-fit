import React, { useState, useEffect } from "react"
import { Input } from "@/app/components/ui/input"
import { Globe, Tag, User, ExternalLink } from "@/app/components/ui/icons"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { Company, COMPANY_INDUSTRIES, COMPANY_SIZES, COMPANY_ANNUAL_REVENUES } from "@/app/companies/types"
import { CompanySelector } from "./CompanySelector"
import { getCompanyById, updateCompany } from "@/app/companies/actions"
import { toast } from "sonner"

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
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)

  // Load company data when component mounts or company_id changes
  useEffect(() => {
    const loadCompanyData = async () => {
      const companyId = isEditing ? editForm.company_id : lead.company_id
      
      if (companyId) {
        setLoading(true)
        try {
          const { company, error } = await getCompanyById(companyId)
          if (error) {
            console.error("Error loading company:", error)
            return
          }
          setSelectedCompany(company)
        } catch (error) {
          console.error("Error loading company:", error)
        } finally {
          setLoading(false)
        }
      } else {
        setSelectedCompany(null)
      }
    }

    loadCompanyData()
  }, [lead.company_id, editForm.company_id, isEditing])

  const handleCompanyChange = (company: Company | null) => {
    setSelectedCompany(company)
    setEditForm(prev => ({
      ...prev,
      company_id: company?.id || null
    }))
  }

  const handleCompanyFieldUpdate = async (field: keyof Company, value: any) => {
    if (!selectedCompany) return

    try {
      // Include required fields when updating
      const updateData = { 
        id: selectedCompany.id,
        name: selectedCompany.name, // Include required name field
        [field]: value 
      }
      const { company: updatedCompany, error } = await updateCompany(updateData)
      
      if (error) {
        toast.error("Error updating company")
        console.error(error)
        return
      }

      if (updatedCompany) {
        setSelectedCompany(updatedCompany)
        toast.success("Company updated successfully")
      }
    } catch (error) {
      console.error("Error updating company:", error)
      toast.error("Error updating company")
    }
  }

  // If not editing, always show read-only view with individual fields
  if (!isEditing) {
    return (
      <div className="grid gap-4 min-w-0">
        {/* Company Name with View Profile Button */}
        {selectedCompany ? (
          <div 
            className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group min-w-0"
            onClick={() => window.open(`/companies/${selectedCompany.id}`, '_blank')}
          >
            <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-[5px] truncate">Company</p>
              <p className="text-sm font-medium text-primary group-hover:underline truncate" title={selectedCompany.name}>
                {selectedCompany.name}
              </p>
            </div>
            <div 
              className="flex items-center gap-1 text-primary hover:underline cursor-pointer flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/companies/${selectedCompany.id}`, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-[5px] truncate">Company</p>
              <p className="text-sm font-medium text-muted-foreground truncate">Not specified</p>
            </div>
          </div>
        )}

        {/* Website */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Website</p>
            {selectedCompany?.website ? (
              <div className="flex items-center gap-2 min-w-0">
                <a 
                  href={selectedCompany.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline truncate flex-1"
                  title={selectedCompany.website}
                >
                  {selectedCompany.website.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground truncate">Not specified</p>
            )}
          </div>
        </div>

        {/* Industry */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Industry</p>
            <p className="text-sm font-medium truncate" title={selectedCompany?.industry ? 
                COMPANY_INDUSTRIES.find(i => i.id === selectedCompany.industry)?.name || selectedCompany.industry 
                : "Not specified"}>
              {selectedCompany?.industry ? 
                COMPANY_INDUSTRIES.find(i => i.id === selectedCompany.industry)?.name || selectedCompany.industry 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Company Size */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Company Size</p>
            <p className="text-sm font-medium truncate" title={selectedCompany?.size ? 
                COMPANY_SIZES.find(s => s.id === selectedCompany.size)?.name || selectedCompany.size 
                : "Not specified"}>
              {selectedCompany?.size ? 
                COMPANY_SIZES.find(s => s.id === selectedCompany.size)?.name || selectedCompany.size 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Description</p>
            <p className="text-sm font-medium break-words" 
               style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
               title={selectedCompany?.description || "Not specified"}>
              {selectedCompany?.description || "Not specified"}
            </p>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Address</p>
            <p className="text-sm font-medium break-words" 
               style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
               title={selectedCompany?.address ? 
                [
                  selectedCompany.address.street,
                  selectedCompany.address.city,
                  selectedCompany.address.state,
                  selectedCompany.address.zipcode,
                  selectedCompany.address.country
                ].filter(Boolean).join(', ') || "Not specified"
                : "Not specified"}>
              {selectedCompany?.address ? 
                [
                  selectedCompany.address.street,
                  selectedCompany.address.city,
                  selectedCompany.address.state,
                  selectedCompany.address.zipcode,
                  selectedCompany.address.country
                ].filter(Boolean).join(', ') || "Not specified"
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Annual Revenue */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Annual Revenue</p>
            <p className="text-sm font-medium truncate" title={selectedCompany?.annual_revenue ? 
                COMPANY_ANNUAL_REVENUES.find(r => r.id === selectedCompany.annual_revenue)?.name || selectedCompany.annual_revenue 
                : "Not specified"}>
              {selectedCompany?.annual_revenue ? 
                COMPANY_ANNUAL_REVENUES.find(r => r.id === selectedCompany.annual_revenue)?.name || selectedCompany.annual_revenue 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Founded */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Founded</p>
            <p className="text-sm font-medium truncate" title={selectedCompany?.founded || "Not specified"}>
              {selectedCompany?.founded || "Not specified"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show company details if a company is selected and we're editing
  if (selectedCompany && isEditing) {
    return (
      <div className="grid gap-4 min-w-0">
        {/* Company Selection */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CompanySelector
              selectedCompanyId={editForm.company_id}
              onCompanyChange={handleCompanyChange}
              isEditing={isEditing}
            />
          </div>
        </div>

        {/* Selected Company Card with Edit Profile Button */}
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors min-w-0">
          <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-[5px] truncate">Selected Company</p>
            <p className="text-sm font-medium truncate" title={selectedCompany.name}>
              {selectedCompany.name}
            </p>
            {selectedCompany.industry && (
              <p className="text-xs text-muted-foreground truncate">
                {COMPANY_INDUSTRIES.find(i => i.id === selectedCompany.industry)?.name || selectedCompany.industry}
              </p>
            )}
          </div>
          <div 
            className="flex items-center gap-1 text-primary hover:underline cursor-pointer flex-shrink-0"
            onClick={() => window.open(`/companies/${selectedCompany.id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">Edit Profile</span>
          </div>
        </div>
      </div>
    )
  }

  // Show company selector if no company is selected or if we're editing and no company
  return (
    <div className="grid gap-4 min-w-0">
      {/* Company Selection */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <CompanySelector
            selectedCompanyId={isEditing ? editForm.company_id : lead.company_id}
            onCompanyChange={handleCompanyChange}
            isEditing={isEditing}
          />
        </div>
      </div>
    </div>
  )
} 