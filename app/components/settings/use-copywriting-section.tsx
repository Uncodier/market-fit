"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { useLocalization } from "../../context/LocalizationContext"
import { type SiteFormValues } from "./form-schema"

import { toast } from "sonner"
import { copywritingService } from "../../context/copywriting-actions"

import { useSite } from "../../context/SiteContext"
import { FileText, MessageCircle, Mail, Phone, Megaphone, Edit } from "../ui/icons"

type CopywritingItem = NonNullable<SiteFormValues["copywriting"]>[number]

interface CopywritingSectionProps {
  active: boolean
  onSave?: () => void
}

// Copy types with simple structure
const copyTypes = [
  { value: "tweet", label: "Tweet", icon: MessageCircle },
  { value: "cold_email", label: "Cold Email", icon: Mail },
  { value: "cold_call", label: "Cold Call Script", icon: Phone },
  { value: "sales_pitch", label: "Sales Pitch", icon: Megaphone },
  { value: "follow_up_email", label: "Follow-up Email", icon: Mail },
  { value: "nurture_email", label: "Nurture Email", icon: Mail },
  { value: "linkedin_message", label: "LinkedIn Message", icon: MessageCircle },
  { value: "ad_copy", label: "Ad Copy", icon: Megaphone },
  { value: "facebook_ad", label: "Facebook Ad", icon: Megaphone },
  { value: "google_ad", label: "Google Ad", icon: Megaphone },
  { value: "landing_page", label: "Landing Page", icon: FileText },
  { value: "email_subject", label: "Email Subject", icon: Mail },
  { value: "newsletter", label: "Newsletter", icon: Mail },
  { value: "blog_post", label: "Blog Post", icon: FileText },
  { value: "case_study", label: "Case Study", icon: FileText },
  { value: "testimonial", label: "Testimonial", icon: MessageCircle },
  { value: "tagline", label: "Tagline", icon: Edit },
  { value: "slogan", label: "Slogan", icon: Edit },
  { value: "product_description", label: "Product Description", icon: Edit },
  { value: "call_to_action", label: "Call to Action", icon: Megaphone },
  { value: "social_post", label: "Social Media Post", icon: MessageCircle },
  { value: "instagram_post", label: "Instagram Post", icon: MessageCircle },
  { value: "instagram_story", label: "Instagram Story", icon: MessageCircle },
  { value: "video_script", label: "Video Script", icon: FileText },
  { value: "webinar_script", label: "Webinar Script", icon: FileText },
  { value: "press_release", label: "Press Release", icon: FileText },
  { value: "proposal", label: "Proposal", icon: FileText },
  { value: "objection_handling", label: "Objection Handling", icon: MessageCircle },
  { value: "faq", label: "FAQ", icon: MessageCircle },
  { value: "blurb", label: "Blurb", icon: FileText },
  { value: "other", label: "Other", icon: FileText }
]

export function useCopywritingSection({ active, onSave }: CopywritingSectionProps) {
  const { t } = useLocalization()
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const [copywritingList, setCopywritingList] = useState<CopywritingItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [lastLoadedSiteId, setLastLoadedSiteId] = useState<string | null>(null)
  const [savingCard, setSavingCard] = useState<number | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Reset hasLoaded when site changes
  useEffect(() => {
    if (currentSite?.id && currentSite.id !== lastLoadedSiteId) {
      console.log("COPYWRITING: Site changed, resetting loaded state. Previous:", lastLoadedSiteId, "New:", currentSite.id)
      setHasLoaded(false)
      setCopywritingList([])
    }
  }, [currentSite?.id, lastLoadedSiteId])

  // Load copywriting data when component becomes active
  useEffect(() => {
    if (!active || hasLoaded || !currentSite) return

    const loadCopywritingData = async () => {
      try {
        setIsLoading(true)
        
        console.log("COPYWRITING: Loading data for site:", currentSite.id)
        const result = await copywritingService.getCopywritingItems(currentSite.id)
        
        if (result.success && result.data) {
          console.log("COPYWRITING: Loaded data:", result.data.length, "items")
          const items = result.data.map(item => ({ ...item, tags: item.tags ?? [], status: item.status ?? "draft" as const }))
          setCopywritingList(items)
          form.setValue("copywriting", items)
          setHasLoaded(true)
          setLastLoadedSiteId(currentSite.id)
        } else {
          console.error("COPYWRITING: Failed to load data:", result.error)
          setHasLoaded(true) // Mark as loaded even on error to prevent infinite retries
        }
      } catch (error) {
        console.error("COPYWRITING: Exception loading data:", error)
        setHasLoaded(true) // Mark as loaded even on error to prevent infinite retries
      } finally {
        setIsLoading(false)
      }
    }

    loadCopywritingData()
  }, [active, hasLoaded, currentSite, form])

  // Emit copywriting items update event whenever list changes
  useEffect(() => {
    if (active && copywritingList.length > 0) {
      const copywritingData = copywritingList.map((item, index) => ({
        id: `copywriting-item-${index}`,
        title: item.title || `Copy ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('copywritingUpdated', { 
        detail: copywritingData 
      }));
    }
  }, [active, copywritingList])

  // Sync copywriting list when form values change (but only after initial load)
  useEffect(() => {
    if (!hasLoaded) return
    
    const subscription = form.watch((value, { name }) => {
      if (name === 'copywriting' && value.copywriting && Array.isArray(value.copywriting)) {
        setCopywritingList(form.getValues("copywriting") ?? [])
      }
    })
    
    return () => subscription.unsubscribe()
  }, [form, hasLoaded])

  // Add new copywriting item
  const addCopywritingItem = () => {
    const newItem: CopywritingItem = {
      title: "",
      content: "",
      copy_type: "other",
      target_audience: "",
      use_case: "",
      notes: "",
      tags: [],
      status: "draft"
    }
    const newList = [newItem, ...copywritingList]
    const newIndex = 0
    
    setCopywritingList(newList)
    form.setValue("copywriting", newList)
    
    // Expand the new item automatically
    setExpandedItems(prev => new Set([0, ...Array.from(prev).map(i => i + 1)]))
  }

  // Remove copywriting item
  const removeCopywritingItem = (index: number) => {
    const newList = copywritingList.filter((_, i) => i !== index)
    setCopywritingList(newList)
    form.setValue("copywriting", newList)
    
    // Update expanded items indices
    const newExpanded = new Set<number>()
    expandedItems.forEach(expandedIndex => {
      if (expandedIndex < index) {
        newExpanded.add(expandedIndex)
      } else if (expandedIndex > index) {
        newExpanded.add(expandedIndex - 1)
      }
      // Skip the removed index
    })
    setExpandedItems(newExpanded)
  }

  // Update copywriting item
  const updateCopywritingItem = (index: number, field: keyof CopywritingItem, value: any) => {
    const newList = [...copywritingList]
    ;(newList[index] as any)[field] = value
    setCopywritingList(newList)
    form.setValue("copywriting", newList)
  }

  // Toggle expanded state for an item
  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  // Save individual copywriting item
  const handleSaveCopywritingItem = async (index: number) => {
    try {
      setSavingCard(index)
      // Trigger form validation for this specific copywriting field
      const isValid = await form.trigger(`copywriting.${index}`)
      
      if (!isValid) {
        toast.error("Please fix validation errors before saving")
        return
      }

      // Get the current copywriting data from the form
      const copywritingData = form.getValues("copywriting") || []
      console.log("COPYWRITING SECTION: Saving copywriting item:", copywritingData[index])

      // Call the parent save function if provided
      if (onSave) {
        // Get all form data and pass it to the save handler
        // The handler will show success/error messages
        await onSave()
      } else {
        // Fallback: trigger the main form save
        const formElement = document.getElementById('context-form') as HTMLFormElement
        if (formElement) {
          formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
      }
    } catch (error) {
      toast.error("Error saving copywriting item")
      console.error("Save error:", error)
    } finally {
      setSavingCard(null)
    }
  }

  return {
    active, onSave, t, form, copywritingList,
    isLoading, savingCard, expandedItems, addCopywritingItem, removeCopywritingItem,
    updateCopywritingItem, toggleExpanded, handleSaveCopywritingItem, copyTypes,
  }
}
