"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues, type CopywritingItem } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { copywritingService } from "../../context/copywriting-actions"
import { CopywritingSkeleton, CopywritingItemsSkeleton } from "../skeletons/copywriting-skeleton"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "../../context/SiteContext"
import { 
  PlusCircle, 
  Trash2, 
  FileText, 
  MessageCircle,
  Mail,
  Phone,
  Megaphone,
  Edit,
  ChevronDown,
  ChevronUp
} from "../ui/icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select"

interface CopywritingSectionProps {
  active: boolean
  onSave?: () => void
  isSaving?: boolean
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

export function CopywritingSection({ active, onSave, isSaving }: CopywritingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const [copywritingList, setCopywritingList] = useState<CopywritingItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [lastLoadedSiteId, setLastLoadedSiteId] = useState<string | null>(null)
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
          setCopywritingList(result.data)
          form.setValue("copywriting", result.data)
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

  // Sync copywriting list when form values change (but only after initial load)
  useEffect(() => {
    if (!hasLoaded) return
    
    const subscription = form.watch((value, { name }) => {
      if (name === 'copywriting' && value.copywriting && Array.isArray(value.copywriting)) {
        setCopywritingList(value.copywriting)
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
    const newList = [...copywritingList, newItem]
    const newIndex = newList.length - 1
    
    setCopywritingList(newList)
    form.setValue("copywriting", newList)
    
    // Expand the new item automatically
    setExpandedItems(prev => new Set([...prev, newIndex]))
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

  // Save copywriting data
  const handleSaveCopywriting = async () => {
    try {
      // Trigger form validation for copywriting fields
      const isValid = await form.trigger("copywriting")
      
      if (!isValid) {
        toast.error("Please fix validation errors before saving")
        return
      }

      // Get the current copywriting data from the form
      const copywritingData = form.getValues("copywriting") || []
      console.log("COPYWRITING SECTION: Saving copywriting data:", copywritingData)

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
      toast.error("Error saving copywriting data")
      console.error("Save error:", error)
    }
  }

  if (!active) return null

  // Show skeleton while loading
  if (isLoading) {
    return copywritingList.length > 0 ? 
      <CopywritingItemsSkeleton count={copywritingList.length} /> : 
      <CopywritingSkeleton />
  }

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Copywriting Collection</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your marketing copy, scripts, and content templates
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <div className="space-y-6">
          {/* Empty state */}
          {copywritingList.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No copy items yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start building your copywriting collection by adding your first copy item.
              </p>
            </div>
          )}

          {/* Copywriting Items */}
          {copywritingList.length > 0 && (
            <div className="space-y-6">
              {copywritingList.map((item, index) => {
                const copyType = copyTypes.find(type => type.value === item.copy_type)
                const IconComponent = copyType?.icon || FileText
                
                const isExpanded = expandedItems.has(index)
                
                return (
                  <Card key={index} className="border border-border">
                    {/* Collapsible Header */}
                    <CardHeader 
                      className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpanded(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-lg font-semibold pt-1">
                              {item.title || "Untitled Copy"}
                            </CardTitle>
                            {item.copy_type && (
                              <p className="text-sm text-muted-foreground capitalize">
                                {copyType?.label} • {item.status || "draft"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCopywritingItem(index)
                            }}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {/* Collapsible Content */}
                    {isExpanded && (
                      <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t">
                      {/* Title */}
                      <FormField
                        control={form.control}
                        name={`copywriting.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Copy title"
                                value={item.title || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateCopywritingItem(index, 'title', e.target.value)
                                }}
                                className="h-12 text-base"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Copy Type and Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name={`copywriting.${index}.copy_type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Copy Type</FormLabel>
                              <FormControl>
                                <Select
                                  value={item.copy_type}
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    updateCopywritingItem(index, 'copy_type', value)
                                  }}
                                >
                                  <SelectTrigger className="h-11">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {copyTypes.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`copywriting.${index}.status`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <Select
                                  value={item.status || "draft"}
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    updateCopywritingItem(index, 'status', value)
                                  }}
                                >
                                  <SelectTrigger className="h-11">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="review">Review</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Content */}
                      <FormField
                        control={form.control}
                        name={`copywriting.${index}.content`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter your copy content here..."
                                value={item.content || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateCopywritingItem(index, 'content', e.target.value)
                                }}
                                className="min-h-[120px] resize-y"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Target Audience and Use Case */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name={`copywriting.${index}.target_audience`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Audience</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Who is this copy for?"
                                  value={item.target_audience || ""}
                                  onChange={(e) => {
                                    field.onChange(e)
                                    updateCopywritingItem(index, 'target_audience', e.target.value)
                                  }}
                                  className="h-12 text-base"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`copywriting.${index}.use_case`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Use Case</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="When will you use this copy?"
                                  value={item.use_case || ""}
                                  onChange={(e) => {
                                    field.onChange(e)
                                    updateCopywritingItem(index, 'use_case', e.target.value)
                                  }}
                                  className="h-12 text-base"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Notes */}
                      <FormField
                        control={form.control}
                        name={`copywriting.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Performance notes, variations, or additional context..."
                                value={item.notes || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateCopywritingItem(index, 'notes', e.target.value)
                                }}
                                className="min-h-[80px] resize-y"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Add New Button */}
          <Button
            variant="outline"
            className="w-full h-12"
            type="button"
            onClick={addCopywritingItem}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Copy Item
          </Button>


        </div>
      </CardContent>
      
      {/* Card Footer with Save Button */}
      <CardFooter className="px-8 py-6 bg-muted/30 border-t">
        <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                {copywritingList.length > 0 && (
                  <span>
                    {copywritingList.filter(item => item.status === 'approved').length} of {copywritingList.length} approved copys
                  </span>
                )}
              </div>
          <Button 
            onClick={handleSaveCopywriting}
            disabled={isSaving || copywritingList.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Save Copywriting
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}