import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Globe, Tag, User, ExternalLink } from "@/app/components/ui/icons"
import { Company, COMPANY_INDUSTRIES, COMPANY_SIZES, getDisplayName } from "@/app/companies/types"
import { Badge } from "@/app/components/ui/badge"

interface CompanyCardProps {
  company: Company
  showFullDetails?: boolean
}

export function CompanyCard({ company, showFullDetails = false }: CompanyCardProps) {
  const router = useRouter()

  const handleCompanyClick = () => {
    router.push(`/companies/${company.id}`)
  }

  const industryName = company.industry ? 
    COMPANY_INDUSTRIES.find(i => i.id === company.industry)?.name : null

  const sizeName = company.size ? 
    COMPANY_SIZES.find(s => s.id === company.size)?.name : null

  if (showFullDetails) {
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <button
              onClick={handleCompanyClick}
              className="text-left hover:text-primary transition-colors group"
            >
              <h3 className="font-semibold text-lg group-hover:underline truncate">
                {getDisplayName(company)}
              </h3>
            </button>
            {company.legal_name && company.legal_name !== company.name && (
              <p className="text-xs text-muted-foreground mt-1">
                Legal: {company.legal_name}
              </p>
            )}
          </div>
          {company.is_public && company.stock_symbol && (
            <Badge variant="secondary" className="ml-2 shrink-0">
              {company.stock_symbol}
            </Badge>
          )}
        </div>

        {/* Key Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {industryName && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{industryName}</span>
            </div>
          )}
          
          {sizeName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{sizeName}</span>
            </div>
          )}
          
          {company.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a 
                href={company.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}

          {company.tax_country && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tax: {company.tax_country}</span>
            </div>
          )}
        </div>

        {/* Description (if available and not too long) */}
        {company.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {company.description}
          </p>
        )}

        {/* Location */}
        {(company.address?.city || company.address?.country) && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span>
              {[company.address?.city, company.address?.state, company.address?.country]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Compact version for smaller spaces
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <button
          onClick={handleCompanyClick}
          className="text-left hover:text-primary transition-colors group"
        >
          <h4 className="font-medium group-hover:underline truncate">
            {getDisplayName(company)}
          </h4>
        </button>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {industryName && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {industryName}
            </span>
          )}
          
          {sizeName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {sizeName}
            </span>
          )}
        </div>
      </div>

      {company.is_public && company.stock_symbol && (
        <Badge variant="outline" className="ml-2 shrink-0 text-xs">
          {company.stock_symbol}
        </Badge>
      )}
    </div>
  )
} 