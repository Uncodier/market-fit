"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { useDropzone } from "react-dropzone"

import type { ResourceUrl } from "@/lib/types/database.types"
import type { Site } from "@/app/context/SiteContext"

const createSiteFormSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  url: z.string().url("Debe ser una URL válida"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  competitors: z.array(z.object({
    url: z.string().url("Debe ser una URL válida"),
    name: z.string().optional()
  })).optional().default([]),
  focusMode: z.number().min(0).max(100),
  resource_urls: z.array(z.object({
    key: z.string().min(1, "El nombre es requerido"),
    url: z.string().url("Debe ser una URL válida")
  })).optional().default([]),
  locations: z.array(z.object({
    name: z.string().min(1, "Location name is required"),
    type: z.string().default("physical"),
    restrictions: z.object({
      enabled: z.boolean().default(false),
      included_addresses: z.array(z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        country: z.string().optional()
      })).default([]),
      excluded_addresses: z.array(z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        country: z.string().optional()
      })).default([])
    }).optional()
  })).optional().default([])
})

type CreateSiteFormValues = z.infer<typeof createSiteFormSchema>

interface CreateSiteFormProps {
  onSubmit: (data: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => void
  isSaving?: boolean
}

export function useCreateSiteForm({ onSubmit, isSaving }: CreateSiteFormProps) {
  const [globalRestrictionsEnabled, setGlobalRestrictionsEnabled] = useState(false)
  
  const form = useForm<CreateSiteFormValues>({
    resolver: zodResolver(createSiteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      logo_url: "",
      competitors: [],
      focusMode: 50,
      resource_urls: [],
      locations: []
    }
  })

  const handleSubmit = async (data: CreateSiteFormValues) => {
    const siteData: Omit<Site, 'id' | 'created_at' | 'updated_at'> = {
      name: data.name,
      url: data.url,
      description: data.description || null,
      logo_url: data.logo_url || null,
      resource_urls: data.resource_urls as ResourceUrl[] || null,
      user_id: '', // Este valor será sobrescrito por el componente padre
      settings: {
        competitors: data.competitors,
        locations: data.locations || [],
        focus_mode: data.focusMode
      }
    }
    onSubmit(siteData)
  }

  const getFocusModeConfig = (value: number) => {
    // Strong sales focus (0-20)
    if (value <= 20) {
      return {
        label: "Revenue Maximizer",
        description: "Agents will aggressively pursue sales opportunities and conversions, prioritizing immediate revenue.",
        features: [
          "Agents will proactively suggest premium upgrades in every interaction",
          "Responses focus heavily on ROI and business impact",
          "Strong emphasis on exclusive paid features",
          "Enterprise client queries receive highest priority",
          "Messaging optimized for direct purchase decisions"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Moderate sales focus (21-40)
    if (value <= 40) {
      return {
        label: "Sales Focus",
        description: "Agents will prioritize conversion opportunities while still providing quality support.",
        features: [
          "Agents regularly suggest premium plans when relevant",
          "Responses emphasize value proposition and business benefits",
          "Most examples demonstrate premium features",
          "High-value customer queries are prioritized",
          "Messaging includes clear calls-to-action for upgrades"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Slight sales tilt (41-49)
    if (value <= 49) {
      return {
        label: "Balanced (Sales Leaning)",
        description: "Agents will balance support with strategic sales opportunities, with a slight focus on conversions.",
        features: [
          "Agents provide thorough support with occasional upgrade suggestions",
          "Responses blend educational content with commercial benefits",
          "Examples include both free and premium capabilities",
          "Equal attention to all users with slight prioritization of paying customers",
          "Messaging subtly highlights premium value"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Perfect balance (50)
    if (value === 50) {
      return {
        label: "Perfect Balance",
        description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
        features: [
          "Agents perfectly balance helpfulness and business objectives",
          "Responses give equal weight to educational and commercial content",
          "Examples show balanced use cases for all user tiers",
          "All users receive identical priority and attention",
          "Messaging combines educational value with subtle commercial elements"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Slight growth tilt (51-60)
    if (value <= 60) {
      return {
        label: "Balanced (Growth Leaning)",
        description: "Agents will focus on helpful support with user growth in mind, with minimal sales emphasis.",
        features: [
          "Agents prioritize being helpful with minimal sales messaging",
          "Responses focus on user education with rare premium mentions",
          "Examples primarily showcase free features with some premium options",
          "New users receive slightly higher priority",
          "Messaging emphasizes user success with subtle premium references"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Moderate growth focus (61-80)
    if (value <= 80) {
      return {
        label: "Growth Focus",
        description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
        features: [
          "Agents focus primarily on user satisfaction and education",
          "Responses provide in-depth guidance without sales pressure",
          "Examples highlight free features and community benefits",
          "New user onboarding is highly prioritized",
          "Messaging centered on long-term user success"
        ],
        color: "text-green-600",
        sliderClass: "bg-green-600"
      }
    }
    
    // Strong growth focus (81-100)
    return {
      label: "Growth Maximizer",
      description: "Agents will exclusively focus on user experience, education, and community building.",
      features: [
        "Agents exclusively provide helpful support with no sales messaging",
        "Responses offer comprehensive educational content and resources",
        "Examples exclusively demonstrate free and community features",
        "New users receive the highest level of attention and care",
        "Messaging entirely focused on user empowerment and success"
      ],
      color: "text-green-600",
      sliderClass: "bg-green-600"
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          form.setValue("logo_url", reader.result as string, { shouldDirty: true, shouldValidate: true })
        }
        reader.readAsDataURL(file)
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  })

  // Location handlers
  const handleAddLocation = () => {
    const current = form.getValues("locations") || []
    form.setValue("locations", [...current, { 
      name: "", 
      type: "physical",
      restrictions: {
        enabled: false,
        included_addresses: [],
        excluded_addresses: []
      }
    }])
  }

  const handleRemoveLocation = (index: number) => {
    const current = form.getValues("locations") || []
    form.setValue("locations", current.filter((_, i) => i !== index))
  }

  // Regional restrictions handlers
  const handleAddIncludedAddress = (locationIndex: number) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: false,
        included_addresses: [],
        excluded_addresses: []
      }
    }
    updatedLocations[locationIndex].restrictions!.included_addresses = [
      ...(updatedLocations[locationIndex].restrictions!.included_addresses || []),
      { name: "", address: "", city: "", state: "", zip: "", country: "" }
    ]
    form.setValue("locations", updatedLocations)
  }

  const handleAddExcludedAddress = (locationIndex: number) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: false,
        included_addresses: [],
        excluded_addresses: []
      }
    }
    updatedLocations[locationIndex].restrictions!.excluded_addresses = [
      ...(updatedLocations[locationIndex].restrictions!.excluded_addresses || []),
      { name: "", address: "", city: "", state: "", zip: "", country: "" }
    ]
    form.setValue("locations", updatedLocations)
  }

  const handleRemoveIncludedAddress = (locationIndex: number, addressIndex: number) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    updatedLocations[locationIndex].restrictions!.included_addresses = 
      (updatedLocations[locationIndex].restrictions!.included_addresses || []).filter((_: any, i: number) => i !== addressIndex)
    form.setValue("locations", updatedLocations)
  }

  const handleRemoveExcludedAddress = (locationIndex: number, addressIndex: number) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    updatedLocations[locationIndex].restrictions!.excluded_addresses = 
      (updatedLocations[locationIndex].restrictions!.excluded_addresses || []).filter((_: any, i: number) => i !== addressIndex)
    form.setValue("locations", updatedLocations)
  }

  const handleIncludedAddressUpdate = (locationIndex: number, addressIndex: number, field: string, value: string) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    const updatedAddresses = [...(updatedLocations[locationIndex].restrictions!.included_addresses || [])]
    updatedAddresses[addressIndex] = {
      ...updatedAddresses[addressIndex],
      [field]: value
    }
    updatedLocations[locationIndex].restrictions!.included_addresses = updatedAddresses
    form.setValue("locations", updatedLocations)
  }

  const handleExcludedAddressUpdate = (locationIndex: number, addressIndex: number, field: string, value: string) => {
    const locations = form.getValues("locations") || []
    const updatedLocations = [...locations]
    const updatedAddresses = [...(updatedLocations[locationIndex].restrictions!.excluded_addresses || [])]
    updatedAddresses[addressIndex] = {
      ...updatedAddresses[addressIndex],
      [field]: value
    }
    updatedLocations[locationIndex].restrictions!.excluded_addresses = updatedAddresses
    form.setValue("locations", updatedLocations)
  }

  return {
    onSubmit, isSaving, globalRestrictionsEnabled, setGlobalRestrictionsEnabled, form,
    handleSubmit, getFocusModeConfig, getRootProps, getInputProps, handleAddLocation,
    handleRemoveLocation, handleAddIncludedAddress, handleAddExcludedAddress, handleRemoveIncludedAddress, handleRemoveExcludedAddress,
    handleIncludedAddressUpdate, handleExcludedAddressUpdate,
  }
}
