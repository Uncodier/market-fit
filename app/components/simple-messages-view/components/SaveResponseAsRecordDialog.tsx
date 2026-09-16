"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { Loader } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useRelationOptions } from "@/app/records/hooks/useRelationOptions"
import {
  createResponseRecord,
  getResponseRecordCategories,
  type ResponseRecordCategory,
} from "@/app/records/response-record-actions"

interface SaveResponseAsRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userPrompt?: string
  response: string
}

function relationFieldLabel(name: string | undefined, target: string) {
  const configuredName = name?.trim()
  if (configuredName) return configuredName
  const targetName = target.replaceAll("_", " ")
  return targetName.charAt(0).toUpperCase() + targetName.slice(1)
}

export function SaveResponseAsRecordDialog({
  open,
  onOpenChange,
  userPrompt,
  response,
}: SaveResponseAsRecordDialogProps) {
  const { currentSite } = useSite()
  const [categories, setCategories] = useState<ResponseRecordCategory[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [relations, setRelations] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const selectedCategory = categories.find((category) => category.id === categoryId)
  const relationFields = useMemo(
    () => (selectedCategory?.template_fields || []).filter((field) => field.type === "relation"),
    [selectedCategory],
  )
  const selectedRelationIds = useMemo(() => Object.values(relations), [relations])
  const { relationOptions, handleSearchChange } = useRelationOptions(
    relationFields,
    currentSite?.id,
    selectedRelationIds,
  )

  useEffect(() => {
    if (!open) {
      setCategoryId("")
      setRelations({})
      return
    }
    if (!currentSite?.id) return

    let cancelled = false
    setIsLoading(true)
    void getResponseRecordCategories(currentSite.id).then((result) => {
      if (cancelled) return
      setCategories(result.categories)
      if (result.error) toast.error(result.error)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [currentSite?.id, open])

  const handleSave = async () => {
    if (!currentSite?.id || !categoryId || isSaving) return
    setIsSaving(true)
    const result = await createResponseRecord({
      siteId: currentSite.id,
      categoryId,
      title: userPrompt?.trim() || "AI response",
      response,
      relations,
    })
    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success("Response saved as a record")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Save response as record</DialogTitle>
          <DialogDescription>
            Select a category, then optionally connect this response to related records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading categories">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="flex justify-end gap-2 pt-5">
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </div>
          ) : categories.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Create a record category before saving this response.
            </p>
          ) : (
            <>
              <Select
                value={categoryId}
                onValueChange={(nextCategoryId) => {
                  setCategoryId(nextCategoryId)
                  setRelations({})
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryId && relationFields.length > 0 && (
                <div className="space-y-4 border-t pt-5">
                  <p className="text-sm font-medium">Optional relations</p>
                  {relationFields.map((field) => {
                    const target = field.relationTarget || "lead"
                    const fieldLabel = relationFieldLabel(field.name, target)
                    const options = relationOptions[target] || []
                    const selectedId = relations[field.name]
                    const selectedOption = options.find((option) => option.id === selectedId)
                    return (
                      <RelationSelect
                        key={field.id || field.name}
                        label={fieldLabel}
                        options={options}
                        value={
                          selectedId
                            ? { mode: "existing", id: selectedId, label: selectedOption?.label || selectedId }
                            : null
                        }
                        onSearchChange={(query) => handleSearchChange(target, query)}
                        onValueChange={(value) => {
                          setRelations((current) => {
                            if (!value || value.mode !== "existing") {
                              const next = { ...current }
                              delete next[field.name]
                              return next
                            }
                            return { ...current, [field.name]: value.id }
                          })
                        }}
                        allowCreate={false}
                        placeholder={`Search ${fieldLabel.toLowerCase()}...`}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {!isLoading && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={!categoryId || isSaving}>
              {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Save record
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
