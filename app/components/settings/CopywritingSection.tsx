"use client"

import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "../ui/button"

import { CopywritingSkeleton, CopywritingItemsSkeleton } from "../skeletons/copywriting-skeleton"

import { PlusCircle, Trash2, FileText, ChevronDown, ChevronUp } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog"
import { useCopywritingSection } from "./use-copywriting-section"
type CopywritingItem = NonNullable<SiteFormValues["copywriting"]>[number]

interface CopywritingSectionProps {
  active: boolean
  onSave?: () => void
}

// Copy types with simple structure

export function CopywritingSection(props: CopywritingSectionProps) {
 const { active, t, form, copywritingList, isLoading, savingCard, expandedItems, addCopywritingItem, removeCopywritingItem, updateCopywritingItem, toggleExpanded, handleSaveCopywritingItem, copyTypes } = useCopywritingSection(props)
  if (!active) return null

  // Show skeleton while loading
  if (isLoading) {
    return copywritingList.length > 0 ? 
      <CopywritingItemsSkeleton count={copywritingList.length} /> : 
      <CopywritingSkeleton />
  }

  return (
    <div id="copywriting-collection" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t('copywriting.section.title') || 'Copy Sequences'}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('copywriting.section.subtitle') || 'Manage your marketing copy, scripts, and content templates'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCopywritingItem}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('copywriting.section.addItem') || 'Add Copy Item'}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Copywriting Items */}
          {copywritingList.map((item, index) => {
                const copyType = copyTypes.find(type => type.value === item.copy_type)
                const IconComponent = copyType?.icon || FileText
                
                const isExpanded = expandedItems.has(index)
                
                return (
                  <SectionCard key={index} >
                    {/* Collapsible Header */}
                    <SectionCardHeader className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpanded(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <SectionCardTitle className="pt-1">
                              {item.title || (t('copywriting.section.untitled') || 'Untitled Copy')}
                            </SectionCardTitle>
                            {item.copy_type && (
                              <p className="text-sm text-muted-foreground capitalize">
                                {copyType?.label} • {item.status || "draft"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </SectionCardHeader>
                    
                    {/* Collapsible Content */}
                    {isExpanded && (
                      <>
                      <SectionCardContent className="space-y-4 border-t">
                      {/* Title */}
                      <FormField
                        control={form.control}
                        name={`copywriting.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('copywriting.form.title') || 'Title'}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('copywriting.form.titlePlaceholder') || 'Copy title'}
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
                              <FormLabel>{t('copywriting.form.copyType') || 'Copy Type'}</FormLabel>
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
                              <FormLabel>{t('copywriting.form.status') || 'Status'}</FormLabel>
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
                                    <SelectItem value="draft">{t('copywriting.form.draft') || 'Draft'}</SelectItem>
                                    <SelectItem value="review">{t('copywriting.form.review') || 'Review'}</SelectItem>
                                    <SelectItem value="approved">{t('copywriting.form.approved') || 'Approved'}</SelectItem>
                                    <SelectItem value="published">{t('copywriting.form.published') || 'Published'}</SelectItem>
                                    <SelectItem value="archived">{t('copywriting.form.archived') || 'Archived'}</SelectItem>
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
                            <FormLabel>{t('copywriting.form.content') || 'Content'}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t('copywriting.form.contentPlaceholder') || 'Enter your copy content here...'}
                                value={item.content || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateCopywritingItem(index, 'content', e.target.value)
                                }}
                                className="min-h-[72px] resize-y"
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
                              <FormLabel>{t('copywriting.form.targetAudience') || 'Target Audience'}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('copywriting.form.targetAudiencePlaceholder') || 'Who is this copy for?'}
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
                              <FormLabel>{t('copywriting.form.useCase') || 'Use Case'}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('copywriting.form.useCasePlaceholder') || 'When will you use this copy?'}
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
                            <FormLabel>{t('copywriting.form.notes') || 'Notes'}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t('copywriting.form.notesPlaceholder') || 'Performance notes, variations, or additional context...'}
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
                      </SectionCardContent>
                      
                      {/* Card Footer with individual Save Button */}
                      <SectionCardFooter>
                        <div className="flex items-center justify-between w-full">
                          <div className="text-sm text-muted-foreground">
                            {item.status && (
                              <span className="capitalize">{t('copywriting.form.statusLabel') || 'Status'}: {item.status}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('copywriting.form.removeCopy') || 'Remove Copy'}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('copywriting.form.removeCopyTitle') || 'Remove Copy'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('copywriting.form.removeCopyDescription') || 'Are you sure you want to remove this copywriting item? This action cannot be undone.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeCopywritingItem(index)}
                                    className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                                  >
                                    {t('copywriting.form.removeCopy') || 'Remove Copy'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button 
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveCopywritingItem(index)}
                              disabled={savingCard === index || !form.formState.isDirty}
                            >
                              {savingCard === index ? (t('copywriting.form.saving') || 'Saving...') : (t('copywriting.form.saveCopy') || 'Save Copy')}
                            </Button>
                          </div>
                        </div>
                      </SectionCardFooter>
                      </>
                    )}
                  </SectionCard>
                )
              })}
        </div>
      )}
    </div>
  )
}