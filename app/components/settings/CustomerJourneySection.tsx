"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { 
  Eye, 
  FileText, 
  Target, 
  CreditCard, 
  Heart, 
  Users,
  TrendingUp,
  Plus,
  Trash2
} from "../ui/icons"
import { useFormContext, useFieldArray } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"

interface CustomerJourneyStage {
  id: keyof SiteFormValues["customer_journey"]
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

const customerJourneyStages: CustomerJourneyStage[] = [
  {
    id: "awareness",
    title: "Awareness",
    description: "Customer discovers your brand and products for the first time",
    icon: <Eye className="h-6 w-6" />,
    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
  },
  {
    id: "consideration",
    title: "Consideration",
    description: "Customer evaluates your product against alternatives",
    icon: <Target className="h-6 w-6" />,
    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
  },
  {
    id: "decision",
    title: "Decision",
    description: "Customer makes the decision to move forward with purchase",
    icon: <FileText className="h-6 w-6" />,
    color: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
  },
  {
    id: "purchase",
    title: "Purchase",
    description: "Customer completes the transaction and becomes a customer",
    icon: <CreditCard className="h-6 w-6" />,
    color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
  },
  {
    id: "retention",
    title: "Retention",
    description: "Customer continues using your product or service",
    icon: <Heart className="h-6 w-6" />,
    color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800"
  },
  {
    id: "referral",
    title: "Referral",
    description: "Customer refers others and becomes a brand advocate",
    icon: <Users className="h-6 w-6" />,
    color: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
  }
]

interface StageInputsProps {
  stageId: keyof SiteFormValues["customer_journey"]
  fieldType: "metrics" | "actions" | "tactics"
  title: string
  placeholder: string
}

function StageInputs({ stageId, fieldType, title, placeholder }: StageInputsProps) {
  const { control } = useFormContext<SiteFormValues>()
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: `customer_journey.${stageId}.${fieldType}` as any
  })

  const addItem = () => {
    append("")
  }

  const removeItem = (index: number) => {
    remove(index)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              {...control.register(`customer_journey.${stageId}.${fieldType}.${index}` as any)}
              placeholder={placeholder}
              className="flex-1 h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              className="h-8 w-8 p-0 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
            No {fieldType.toLowerCase()} configured. Click "Add" to get started.
          </div>
        )}
      </div>
    </div>
  )
}

interface CustomerJourneySectionProps {
  active: boolean
}

export function CustomerJourneySection({ active }: CustomerJourneySectionProps) {
  if (!active) return null

  return (
    <div className="space-y-8">
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-semibold text-foreground">Customer Journey Configuration</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Configure key metrics, actions, and tactics for each stage of your customer's journey.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {customerJourneyStages.map((stage) => (
          <Card key={stage.id} className={`border transition-all duration-200 hover:shadow-lg ${stage.color}`}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-white/60 dark:border-gray-600/60 flex items-center justify-center shrink-0 shadow-sm">
                  {stage.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-100">{stage.title}</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{stage.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              <StageInputs
                stageId={stage.id}
                fieldType="metrics"
                title="Key Metrics"
                placeholder="e.g., Website traffic, Impressions, Reach"
              />
              
              <StageInputs
                stageId={stage.id}
                fieldType="actions"
                title="Actions"
                placeholder="e.g., Content marketing, Social media ads"
              />
              
              <StageInputs
                stageId={stage.id}
                fieldType="tactics"
                title="Tactics"
                placeholder="e.g., Blog posts, Video content, Email campaigns"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 