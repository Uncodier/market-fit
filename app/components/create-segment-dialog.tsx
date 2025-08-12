"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { 
  PlusCircle, 
  User, 
  FileText, 
  Users, 
  Globe 
} from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"

interface CreateSegmentDialogProps {
  onCreateSegment: (data: { 
    name: string
    description: string
    audience: string
    language: string
    site_id: string
  }) => Promise<void>
  trigger?: React.ReactNode
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'bn', label: 'Bengali' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'ur', label: 'Urdu' },
  { value: 'id', label: 'Indonesian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'it', label: 'Italian' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fa', label: 'Persian' },
  { value: 'pl', label: 'Polish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ro', label: 'Romanian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'el', label: 'Greek' },
  { value: 'cs', label: 'Czech' },
  { value: 'sv', label: 'Swedish' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'da', label: 'Danish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'no', label: 'Norwegian' }
] as const

const AUDIENCES = [
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'smb', label: 'Small & Medium Business' },
  { value: 'startup', label: 'Startups' },
  { value: 'b2b_saas', label: 'B2B SaaS' },
  { value: 'e_commerce', label: 'E-commerce' },
  { value: 'tech', label: 'Technology' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'hospitality', label: 'Hospitality & Tourism' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'telecom', label: 'Telecommunications' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'construction', label: 'Construction' },
  { value: 'logistics', label: 'Logistics & Transportation' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'government', label: 'Government' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'pharma', label: 'Pharmaceutical' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'research', label: 'Research & Development' },
  { value: 'aerospace', label: 'Aerospace & Defense' },
  { value: 'gaming', label: 'Gaming & Entertainment' }
] as const

export function CreateSegmentDialog({ onCreateSegment, trigger }: CreateSegmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [audience, setAudience] = useState("")
  const [language, setLanguage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentSite } = useSite()

  const handleSubmit = async () => {
    // Validar que exista un sitio seleccionado
    if (!currentSite?.id) {
      setError("Por favor, selecciona un sitio primero")
      return
    }

    // Validar campos requeridos
    if (!name || !description || !audience || !language) {
      setError("Por favor, completa todos los campos")
      return
    }
    
    setIsSubmitting(true)
    setError(null)

    try {
      await onCreateSegment({ 
        name, 
        description,
        audience, 
        language,
        site_id: currentSite.id
      })
      
      // Limpiar el formulario y cerrar el modal
      setName("")
      setDescription("")
      setAudience("")
      setLanguage("")
      setIsOpen(false)
    } catch (err) {
      console.error("Error creating segment:", err)
      setError(err instanceof Error ? err.message : "Error al crear el segmento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New Segment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Segment</DialogTitle>
          <DialogDescription>
            Create a new segment to target specific audiences. Additional details will be filled automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Enter segment name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Description
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="description"
                placeholder="Describe your target audience niche"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px] pl-9 pt-2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="audience" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Audience
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-4 h-4 w-4 text-muted-foreground z-10" />
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="h-12 pl-9">
                  <SelectValue placeholder="Select audience type" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {AUDIENCES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="language" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Language
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-4 h-4 w-4 text-muted-foreground z-10" />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-12 pl-9">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {LANGUAGES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !name || !description || !audience || !language}
          >
            {isSubmitting ? (
              <>
                <LoadingSkeleton variant="button" size="sm" className="text-white" />
                Creating...
              </>
            ) : (
              'Create Segment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 