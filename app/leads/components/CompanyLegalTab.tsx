import React from "react"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Globe, Tag, User, ExternalLink, CreditCard } from "@/app/components/ui/icons"
import { Company, LEGAL_STRUCTURES } from "@/app/companies/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Checkbox } from "@/app/components/ui/checkbox"

interface CompanyLegalTabProps {
  company: Company
  isEditing: boolean
  onFieldUpdate: (field: keyof Company, value: any) => void
}

export function CompanyLegalTab({ company, isEditing, onFieldUpdate }: CompanyLegalTabProps) {
  return (
    <div className="grid gap-4">
      {/* Legal Name */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Legal Name</p>
          {isEditing ? (
            <Input
              value={company.legal_name || ""}
              onChange={(e) => onFieldUpdate('legal_name', e.target.value)}
              className="h-12 text-sm"
              placeholder="Official legal name"
            />
          ) : (
            <p className="text-sm font-medium">{company.legal_name || "Not specified"}</p>
          )}
        </div>
      </div>

      {/* Legal Structure */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-[5px]">Legal Structure</p>
          {isEditing ? (
            <Select
              value={company.legal_structure || "none"}
              onValueChange={(value) => onFieldUpdate('legal_structure', value === "none" ? undefined : value)}
            >
              <SelectTrigger className="h-12 text-sm">
                <SelectValue placeholder="Select legal structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {LEGAL_STRUCTURES.map(structure => (
                  <SelectItem key={structure.id} value={structure.id}>
                    {structure.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">
              {company.legal_structure ? 
                LEGAL_STRUCTURES.find(s => s.id === company.legal_structure)?.name || company.legal_structure 
                : "Not specified"
              }
            </p>
          )}
        </div>
      </div>

      {/* Tax Information Section */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Tax Information</h4>

        {/* Tax ID */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Tax ID</p>
            {isEditing ? (
              <Input
                value={company.tax_id || ""}
                onChange={(e) => onFieldUpdate('tax_id', e.target.value)}
                className="h-12 text-sm"
                placeholder="EIN, RFC, Tax ID, etc."
              />
            ) : (
              <p className="text-sm font-medium">{company.tax_id || "Not specified"}</p>
            )}
          </div>
        </div>

        {/* Tax Country */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Tax Country</p>
            {isEditing ? (
              <Input
                value={company.tax_country || ""}
                onChange={(e) => onFieldUpdate('tax_country', e.target.value.toUpperCase())}
                className="h-12 text-sm"
                placeholder="US, MX, CA, etc."
                maxLength={2}
              />
            ) : (
              <p className="text-sm font-medium">{company.tax_country || "Not specified"}</p>
            )}
          </div>
        </div>

        {/* Registration Number */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Registration Number</p>
            {isEditing ? (
              <Input
                value={company.registration_number || ""}
                onChange={(e) => onFieldUpdate('registration_number', e.target.value)}
                className="h-12 text-sm"
                placeholder="Business registration number"
              />
            ) : (
              <p className="text-sm font-medium">{company.registration_number || "Not specified"}</p>
            )}
          </div>
        </div>

        {/* VAT Number */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">VAT Number</p>
            {isEditing ? (
              <Input
                value={company.vat_number || ""}
                onChange={(e) => onFieldUpdate('vat_number', e.target.value)}
                className="h-12 text-sm"
                placeholder="VAT/GST registration number"
              />
            ) : (
              <p className="text-sm font-medium">{company.vat_number || "Not specified"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>

        {/* Company Email */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Company Email</p>
            {isEditing ? (
              <Input
                type="email"
                value={company.email || ""}
                onChange={(e) => onFieldUpdate('email', e.target.value)}
                className="h-12 text-sm"
                placeholder="contact@company.com"
              />
            ) : (
              <p className="text-sm font-medium">{company.email || "Not specified"}</p>
            )}
          </div>
        </div>

        {/* Company Phone */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Company Phone</p>
            {isEditing ? (
              <Input
                type="tel"
                value={company.phone || ""}
                onChange={(e) => onFieldUpdate('phone', e.target.value)}
                className="h-12 text-sm"
                placeholder="+1 (555) 123-4567"
              />
            ) : (
              <p className="text-sm font-medium">{company.phone || "Not specified"}</p>
            )}
          </div>
        </div>

        {/* LinkedIn URL */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">LinkedIn URL</p>
            {isEditing ? (
              <Input
                value={company.linkedin_url || ""}
                onChange={(e) => onFieldUpdate('linkedin_url', e.target.value)}
                className="h-12 text-sm"
                placeholder="https://linkedin.com/company/..."
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{company.linkedin_url || "Not specified"}</p>
                {company.linkedin_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(company.linkedin_url, '_blank')}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Public Company Information */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Public Company Information</h4>

        {/* Is Public */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Publicly Traded</p>
            {isEditing ? (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  checked={company.is_public || false}
                  onCheckedChange={(checked) => onFieldUpdate('is_public', checked)}
                />
                <label className="text-sm font-medium">This company is publicly traded</label>
              </div>
            ) : (
              <p className="text-sm font-medium">{company.is_public ? "Yes" : "No"}</p>
            )}
          </div>
        </div>

        {/* Stock Symbol */}
        {(isEditing && company.is_public || !isEditing && company.stock_symbol) && (
          <div className="flex items-center gap-3 mt-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-[5px]">Stock Symbol</p>
              {isEditing ? (
                <Input
                  value={company.stock_symbol || ""}
                  onChange={(e) => onFieldUpdate('stock_symbol', e.target.value.toUpperCase())}
                  className="h-12 text-sm"
                  placeholder="AAPL, MSFT, etc."
                />
              ) : (
                <p className="text-sm font-medium">{company.stock_symbol || "Not specified"}</p>
              )}
            </div>
          </div>
        )}

        {/* Employees Count */}
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-[5px]">Exact Employee Count</p>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                value={company.employees_count || ""}
                onChange={(e) => onFieldUpdate('employees_count', e.target.value ? parseInt(e.target.value) : undefined)}
                className="h-12 text-sm"
                placeholder="1250"
              />
            ) : (
              <p className="text-sm font-medium">
                {company.employees_count ? `${company.employees_count} employees` : "Not specified"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 