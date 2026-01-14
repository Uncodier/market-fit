"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
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
  PlusCircle,
  Trash2
} from "../ui/icons"
import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { useState } from "react"

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
  const { control, watch, setValue } = useFormContext<SiteFormValues>()
  
  const fieldPath = `customer_journey.${stageId}.${fieldType}` as any
  const currentArray = watch(fieldPath) || []
  
  const addItem = () => {
    const newArray = [...currentArray, ""]
    setValue(fieldPath, newArray, { shouldDirty: true, shouldValidate: true })
  }

  const removeItem = (index: number) => {
    const newArray = currentArray.filter((_: any, i: number) => i !== index)
    setValue(fieldPath, newArray, { shouldDirty: true, shouldValidate: true })
  }

  const updateItem = (index: number, value: string) => {
    const newArray = [...currentArray]
    newArray[index] = value
    setValue(fieldPath, newArray, { shouldDirty: true, shouldValidate: true })
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
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      
      <div className="space-y-2">
        {currentArray.map((item: string, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-12 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              className="h-12 w-12 p-0 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {currentArray.length === 0 && (
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
  onSave?: (data: SiteFormValues) => void
}

export function CustomerJourneySection({ active, onSave }: CustomerJourneySectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving customer journey:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!active) return null

  return (
    <div className="space-y-8">
      {customerJourneyStages.map((stage) => (
        <Card key={stage.id} id={`journey-${stage.id}`} className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="px-8 py-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 shadow-sm ${stage.color}`}>
                {stage.icon}
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl font-semibold text-foreground">{stage.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-6">
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
            </div>
          </CardContent>
          <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
            <Button 
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 