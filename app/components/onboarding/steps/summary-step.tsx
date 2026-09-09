"use client"

import { CheckCircle2, ChevronRight, Edit } from "../../ui/icons"
import { SiteOnboardingValues } from "../schemas/onboarding-schema"

interface SummaryStepProps {
  values: SiteOnboardingValues
  onEditStep: (stepId: number) => void
}

export function SummaryStep({ values, onEditStep }: SummaryStepProps) {
  const hasBasicInfo = values.name && values.url
  const hasBusinessHours = values.business_hours && values.business_hours.length > 0 && values.business_hours.some((h: any) => h.name)
  const hasLocations = values.locations && values.locations.length > 0 && values.locations.some((l: any) => l.name)
  const hasCompanyInfo = values.about || values.company_size || values.industry
  const hasMarketing = (values.marketing_budget?.total || values.marketing_budget?.available) || (values.marketing_channels && values.marketing_channels.length > 0)
  const hasProductsServices = (values.products && values.products.length > 0) || (values.services && values.services.length > 0)

  const summaryItems = [
    { id: 1, title: "Basic Information", filled: hasBasicInfo, value: values.name },
    { id: 2, title: "AI Focus Mode", filled: true, value: `${values.focusMode}% Sales / ${100 - (values.focusMode || 50)}% Growth` },
    { id: 3, title: "Business Hours", filled: !!hasBusinessHours, value: hasBusinessHours ? `${values.business_hours?.length} schedules` : "Not provided" },
    { id: 4, title: "Locations", filled: !!hasLocations, value: hasLocations ? `${values.locations?.length} locations` : "Not provided" },
    { id: 5, title: "Company Information", filled: !!hasCompanyInfo, value: hasCompanyInfo ? "Provided" : "Not provided" },
    { id: 6, title: "Marketing", filled: !!hasMarketing, value: hasMarketing ? "Provided" : "Not provided" },
    { id: 7, title: "Products & Services", filled: !!hasProductsServices, value: hasProductsServices ? "Provided" : "Not provided" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {summaryItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.filled ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                {item.filled ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs">{item.id}</span>}
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditStep(item.id)}
              className="p-2 hover:bg-muted rounded-md text-muted-foreground transition-colors flex items-center gap-2 text-sm"
            >
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-4 mt-6">
        <p className="text-sm text-muted-foreground text-center">
          Review your information. You can skip any optional steps or go back to edit them. Once you're ready, click "Create Project" to set up your new site.
        </p>
      </div>
    </div>
  )
}
