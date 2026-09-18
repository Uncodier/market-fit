"use client"

import { toast } from "sonner"
import { updateContent } from "../../actions"
import { getContentTypeName } from "../../utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  BarChart,
  FileText,
  MessageSquare,
  PlusCircle,
  Tag,
  Target,
  Type,
  Users,
  X,
} from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { StarRating } from "@/app/components/ui/rating"
import { Textarea } from "@/app/components/ui/textarea"
import type {
  CampaignOption,
  ContentEditForm,
  EditFormSetter,
  SegmentOption,
} from "../content-item-types"
import {
  ContentStatusIcon,
  getContentTypeIcon,
} from "./content-detail-icons"

type Props = {
  content: any
  editForm: ContentEditForm
  setEditForm: EditFormSetter
  campaigns: CampaignOption[]
  segments: SegmentOption[]
  editorsReady: boolean
  setHasUserMadeChanges: (changed: boolean) => void
}

export function ContentDetailsPanel({
  content,
  editForm,
  setEditForm,
  campaigns,
  segments,
  editorsReady,
  setHasUserMadeChanges,
}: Props) {
  const markChanged = () => {
    if (editorsReady) setHasUserMadeChanges(true)
  }

  const updateRating = (rating: number | null) => {
    setEditForm((previous) => ({ ...previous, performance_rating: rating }))
    updateContent({
      contentId: content.id,
      title: editForm.title,
      description: editForm.description || undefined,
      type: content.type,
      segment_id: (editForm.segmentValue?.mode === "existing" ? editForm.segmentValue.id : editForm.segment_id) || null,
      campaign_id: (editForm.campaignValue?.mode === "existing" ? editForm.campaignValue.id : editForm.campaign_id) || null,
      tags: editForm.tags.length > 0 ? editForm.tags : null,
      text: editForm.text || undefined,
      performance_rating: rating,
      skipRevalidation: true,
    }).then(() => {
      toast.success("Performance rating updated")
    }).catch((error) => {
      console.error("Error updating rating:", error)
      toast.error("Failed to update rating")
    })
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-5">
        <section className="rounded-lg border border-border/30 bg-muted/40 p-4">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Status and Performance
          </h3>
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-muted-foreground" />
                Performance Rating
              </Label>
              <div className="h-12 py-2">
                <StarRating
                  rating={editForm.performance_rating}
                  onRatingChange={updateRating}
                  readonly={false}
                  size="lg"
                  className="w-full justify-around"
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <ContentStatusIcon className="h-4 w-4 text-muted-foreground" />
                Status
              </Label>
              <Select
                value={editForm.status}
                onValueChange={(status) => setEditForm((previous) => ({ ...previous, status }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/30 bg-muted/40 p-4">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Basic Information
          </h3>
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                Title
              </Label>
              <Input
                value={editForm.title}
                onChange={(event) => {
                  setEditForm((previous) => ({ ...previous, title: event.target.value }))
                  markChanged()
                }}
                placeholder="Enter title"
                className="h-11"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description
              </Label>
              <Textarea
                value={editForm.description}
                onChange={(event) => {
                  setEditForm((previous) => ({ ...previous, description: event.target.value }))
                  markChanged()
                }}
                placeholder="Enter description"
                className="min-h-[100px] resize-none"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                {getContentTypeIcon(editForm.type)}
                <span className="text-muted-foreground">Content Type</span>
              </Label>
              <div className="flex items-center gap-3 rounded-md bg-muted p-3">
                <div className="text-primary">{getContentTypeIcon(editForm.type)}</div>
                <span className="font-medium">{getContentTypeName(editForm.type)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/30 bg-muted/40 p-4">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Associations
          </h3>
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Segment
              </Label>
              <RelationSelect
                options={segments.map((segment) => ({ id: segment.id, label: segment.name }))}
                value={editForm.segmentValue}
                onValueChange={(value) => setEditForm((previous) => ({
                  ...previous,
                  segmentValue: value,
                  segment_id: value?.mode === "existing" ? value.id : "",
                }))}
                placeholder="Select a segment"
                emptyMessage="No segments found"
                className="h-11"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Campaign
              </Label>
              <RelationSelect
                options={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.title }))}
                value={editForm.campaignValue}
                onValueChange={(value) => setEditForm((previous) => ({
                  ...previous,
                  campaignValue: value,
                  campaign_id: value?.mode === "existing" ? value.id : "",
                }))}
                placeholder="Select a campaign"
                emptyMessage="No campaigns found"
                className="h-11"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {editForm.tags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="secondary" className="max-w-full border border-gray-300/30 bg-gray-100/20 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    <span className="truncate">{tag}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${tag} tag`}
                      onClick={() => setEditForm((previous) => ({
                        ...previous,
                        tags: previous.tags.filter((_, tagIndex) => tagIndex !== index),
                      }))}
                      className="ml-1 shrink-0 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {editForm.tags.length === 0 && <span className="text-sm text-muted-foreground">No tags assigned</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input placeholder="Enter tag" className="h-11 flex-1" id="new-tag-input" onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  addTag(event.currentTarget, setEditForm)
                  event.preventDefault()
                }} />
                <Button variant="outline" className="h-11 whitespace-nowrap" onClick={() => {
                  const input = document.getElementById("new-tag-input") as HTMLInputElement | null
                  if (input) addTag(input, setEditForm)
                }}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Tag
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/30 bg-muted/40 p-4">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Content Statistics
          </Label>
          <div className="mt-2.5 grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-4">
            <Statistic icon={<FileText className="h-4 w-4" />} label="Characters" value={editForm.char_count} />
            <Statistic icon={<MessageSquare className="h-4 w-4" />} label="Words" value={editForm.word_count} />
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}

function addTag(input: HTMLInputElement, setEditForm: EditFormSetter) {
  const tag = input.value.trim()
  if (!tag) return
  setEditForm((previous) => ({ ...previous, tags: [...previous.tags, tag] }))
  input.value = ""
}

function Statistic({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium text-foreground">{value.toLocaleString() || 0}</span>
      </div>
    </div>
  )
}
