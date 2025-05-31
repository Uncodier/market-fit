import React, { useState, useEffect } from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Globe, Tag, User, ExternalLink } from "@/app/components/ui/icons"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { Company, COMPANY_INDUSTRIES, COMPANY_SIZES, COMPANY_ANNUAL_REVENUES } from "@/app/companies/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CompanySelector } from "./CompanySelector"
import { CompanyLegalTab } from "./CompanyLegalTab"
import { CompanyCard } from "./CompanyCard"
import { getCompanyById, updateCompany } from "@/app/companies/actions"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"

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
      <div className="grid gap-4">
        {/* Company Name with View Profile Button */}
        {selectedCompany ? (
          <div 
            className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
            onClick={() => window.open(`/companies/${selectedCompany.id}`, '_blank')}
          >
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
              <p className="text-sm font-medium text-primary group-hover:underline">
                {selectedCompany.name}
              </p>
            </div>
            <div 
              className="flex items-center gap-1 text-primary hover:underline cursor-pointer shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/companies/${selectedCompany.id}`, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm font-medium">View Profile</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
              <p className="text-sm font-medium text-muted-foreground">Not specified</p>
            </div>
          </div>
        )}

        {/* Website */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Website</p>
            {selectedCompany?.website ? (
              <div className="flex items-center gap-2">
                <a 
                  href={selectedCompany.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {selectedCompany.website.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Not specified</p>
            )}
          </div>
        </div>

        {/* Industry */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Industry</p>
            <p className="text-sm font-medium">
              {selectedCompany?.industry ? 
                COMPANY_INDUSTRIES.find(i => i.id === selectedCompany.industry)?.name || selectedCompany.industry 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Company Size */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Company Size</p>
            <p className="text-sm font-medium">
              {selectedCompany?.size ? 
                COMPANY_SIZES.find(s => s.id === selectedCompany.size)?.name || selectedCompany.size 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
            <p className="text-sm font-medium whitespace-pre-wrap">
              {selectedCompany?.description || "Not specified"}
            </p>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Address</p>
            <p className="text-sm font-medium">
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
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Annual Revenue</p>
            <p className="text-sm font-medium">
              {selectedCompany?.annual_revenue ? 
                COMPANY_ANNUAL_REVENUES.find(r => r.id === selectedCompany.annual_revenue)?.name || selectedCompany.annual_revenue 
                : "Not specified"
              }
            </p>
          </div>
        </div>

        {/* Founded */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Founded</p>
            <p className="text-sm font-medium">
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
      <div className="grid gap-4">
        {/* Company Selection */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <CompanySelector
            selectedCompanyId={editForm.company_id}
            onCompanyChange={handleCompanyChange}
            isEditing={isEditing}
          />
        </div>

        {/* Company Information Tabs */}
        <div className="mt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="legal">Legal & Tax</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="mt-4 space-y-4">
              {/* Website */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Website</p>
                  <Input
                    value={selectedCompany.website || ""}
                    onChange={(e) => handleCompanyFieldUpdate('website', e.target.value)}
                    className="h-12 text-sm"
                    placeholder="Company website"
                  />
                </div>
              </div>
              
              {/* Description */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
                  <textarea
                    value={selectedCompany.description || ""}
                    onChange={(e) => handleCompanyFieldUpdate('description', e.target.value)}
                    className="h-24 text-sm w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Company description"
                  />
                </div>
              </div>
              
              {/* Industry */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Industry</p>
                  <Select
                    value={selectedCompany.industry || "none"}
                    onValueChange={(value) => handleCompanyFieldUpdate('industry', value === "none" ? undefined : value)}
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {COMPANY_INDUSTRIES.map(industry => (
                        <SelectItem key={industry.id} value={industry.id}>
                          {industry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Company Size */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Company Size</p>
                  <Select
                    value={selectedCompany.size || "none"}
                    onValueChange={(value) => handleCompanyFieldUpdate('size', value === "none" ? undefined : value)}
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {COMPANY_SIZES.map(size => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Annual Revenue */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Annual Revenue</p>
                  <Select
                    value={selectedCompany.annual_revenue || "none"}
                    onValueChange={(value) => handleCompanyFieldUpdate('annual_revenue', value === "none" ? undefined : value)}
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select annual revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {COMPANY_ANNUAL_REVENUES.map(revenue => (
                        <SelectItem key={revenue.id} value={revenue.id}>
                          {revenue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Founded */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Founded</p>
                  <Input
                    value={selectedCompany.founded || ""}
                    onChange={(e) => handleCompanyFieldUpdate('founded', e.target.value)}
                    className="h-12 text-sm"
                    placeholder="Year founded"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="mt-4 space-y-4">
              {/* Street */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Street</p>
                  <Input
                    value={selectedCompany.address?.street || ""}
                    onChange={(e) => handleCompanyFieldUpdate('address', { 
                      ...selectedCompany.address || {}, 
                      street: e.target.value 
                    })}
                    className="h-12 text-sm"
                    placeholder="Street address"
                  />
                </div>
              </div>
              
              {/* City */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">City</p>
                  <Input
                    value={selectedCompany.address?.city || ""}
                    onChange={(e) => handleCompanyFieldUpdate('address', { 
                      ...selectedCompany.address || {}, 
                      city: e.target.value 
                    })}
                    className="h-12 text-sm"
                    placeholder="City"
                  />
                </div>
              </div>
              
              {/* State */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">State/Province</p>
                  <Input
                    value={selectedCompany.address?.state || ""}
                    onChange={(e) => handleCompanyFieldUpdate('address', { 
                      ...selectedCompany.address || {}, 
                      state: e.target.value 
                    })}
                    className="h-12 text-sm"
                    placeholder="State/Province"
                  />
                </div>
              </div>
              
              {/* ZIP Code */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">ZIP/Postal Code</p>
                  <Input
                    value={selectedCompany.address?.zipcode || ""}
                    onChange={(e) => handleCompanyFieldUpdate('address', { 
                      ...selectedCompany.address || {}, 
                      zipcode: e.target.value 
                    })}
                    className="h-12 text-sm"
                    placeholder="ZIP/Postal Code"
                  />
                </div>
              </div>
              
              {/* Country */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Country</p>
                  <Input
                    value={selectedCompany.address?.country || ""}
                    onChange={(e) => handleCompanyFieldUpdate('address', { 
                      ...selectedCompany.address || {}, 
                      country: e.target.value 
                    })}
                    className="h-12 text-sm"
                    placeholder="Country"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Legal & Tax Tab */}
            <TabsContent value="legal" className="mt-4">
              <CompanyLegalTab
                company={selectedCompany}
                isEditing={isEditing}
                onFieldUpdate={handleCompanyFieldUpdate}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  // Show company selector if no company is selected or if we're editing and no company
  return (
    <div className="grid gap-4">
      {/* Company Selection */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <CompanySelector
          selectedCompanyId={isEditing ? editForm.company_id : lead.company_id}
          onCompanyChange={handleCompanyChange}
          isEditing={isEditing}
        />
      </div>
    </div>
  )
} 