"use client"

import React, { useState } from "react"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Clock, Link, PlusCircle, Trash2, Copy, ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { EventType } from "@/app/services/profile.service"
import { Site } from "@/app/context/SiteContext"

interface EventTypesSectionProps {
  eventTypes: EventType[]
  sites?: Site[]
  userEmail?: string
  isUpdating: boolean
  onSaveEventTypes: (eventTypes: EventType[]) => Promise<void>
}

function EventTypeFields({
  value,
  onChange,
  sites,
  enabledId,
}: {
  value: Partial<EventType>
  onChange: (next: Partial<EventType>) => void
  sites?: Site[]
  enabledId: string
}) {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">Title</Label>
          <Input
            className="bg-background h-12 text-base"
            value={value.title || ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="30 Minute Meeting"
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">URL Slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">/book/.../</span>
            <Input
              className="bg-background h-12 text-base"
              value={value.slug || ""}
              onChange={(e) =>
                onChange({ ...value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
              }
              placeholder="30-min"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">Duration (min)</Label>
          <Input
            className="bg-background h-12 text-base"
            type="number"
            value={value.duration || 30}
            onChange={(e) => onChange({ ...value, duration: parseInt(e.target.value) || 30 })}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">Buffer (min)</Label>
          <Input
            className="bg-background h-12 text-base"
            type="number"
            value={value.buffer || 0}
            onChange={(e) => onChange({ ...value, buffer: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">Meeting Room / Location URL</Label>
        <Input
          className="bg-background h-12 text-base"
          value={value.location || ""}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="https://meet.google.com/xxx-xxxx-xxx or physical location"
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">Site Dependency</Label>
        <Select value={value.site_id} onValueChange={(v) => onChange({ ...value, site_id: v })}>
          <SelectTrigger className="bg-background h-12 text-base">
            <SelectValue placeholder="Select a site" />
          </SelectTrigger>
          <SelectContent>
            {sites?.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Switch
          id={enabledId}
          checked={value.enabled}
          onCheckedChange={(v) => onChange({ ...value, enabled: v })}
        />
        <Label htmlFor={enabledId} className="text-sm cursor-pointer">
          Enabled
        </Label>
      </div>
    </>
  )
}

export function EventTypesSection({
  eventTypes,
  sites,
  userEmail,
  isUpdating,
  onSaveEventTypes,
}: EventTypesSectionProps) {
  const defaultSlug = userEmail
    ? userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-")
    : ""
  const [editingEventType, setEditingEventType] = useState<Partial<EventType> | null>(null)

  const handleAddEventType = () => {
    setEditingEventType({
      id: crypto.randomUUID(),
      title: "",
      slug: "",
      duration: 30,
      buffer: 15,
      enabled: true,
      site_id: sites?.[0]?.id || "",
    })
  }

  const handleSaveEventType = async () => {
    if (!editingEventType?.title || !editingEventType?.slug) {
      toast.error("Title and slug are required")
      return
    }

    const updatedEventTypes = eventTypes.some((et) => et.id === editingEventType.id)
      ? eventTypes.map((et) => (et.id === editingEventType.id ? (editingEventType as EventType) : et))
      : [...eventTypes, editingEventType as EventType]

    setEditingEventType(null)
    await onSaveEventTypes(updatedEventTypes)
  }

  const handleDeleteEventType = async (id: string) => {
    await onSaveEventTypes(eventTypes.filter((et) => et.id !== id))
  }

  const getSiteName = (siteId?: string) => {
    const site = sites?.find((s) => s.id === siteId)
    return site?.name?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "default"
  }

  const getBookingUrl = (et: EventType) => {
    const siteSlug = getSiteName(et.site_id)
    return typeof window !== "undefined"
      ? `${window.location.origin}/book/${siteSlug}/${defaultSlug}/${et.slug}`
      : `/book/${siteSlug}/${defaultSlug}/${et.slug}`
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }

  const groupedEventTypes = eventTypes.reduce((acc, et) => {
    const siteId = et.site_id || "default"
    if (!acc[siteId]) acc[siteId] = []
    acc[siteId].push(et)
    return acc
  }, {} as Record<string, EventType[]>)

  const isCreatingNew =
    !!editingEventType && !eventTypes.some((et) => et.id === editingEventType.id)

  return (
    <div id="event-types" className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Clock className="h-6 w-6 text-foreground" />
            Event Types
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your booking links and meeting types
          </p>
        </div>
        {!editingEventType && (
          <Button onClick={handleAddEventType} size="sm" variant="outline" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Event Type
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {isCreatingNew && editingEventType && (
          <SectionCard className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden mb-4">
            <SectionCardHeader>
              <SectionCardTitle className="text-lg font-semibold">New Event Type</SectionCardTitle>
            </SectionCardHeader>
            <SectionCardContent className="space-y-4 border-t border-border">
              <EventTypeFields
                value={editingEventType}
                onChange={setEditingEventType}
                sites={sites}
                enabledId="new-et-enabled"
              />
            </SectionCardContent>
            <ActionFooter>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEditingEventType(null)}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={handleSaveEventType} disabled={isUpdating} size="sm">
                  {isUpdating ? "Saving..." : "Create Event Type"}
                </Button>
              </div>
            </ActionFooter>
          </SectionCard>
        )}

        {eventTypes.length === 0 && !editingEventType ? (
          <div className="py-6">
            <EmptyCard
              icon={<Clock />}
              title="No event types configured yet"
              description="Create event types to manage your booking links and meeting availability."
            />
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedEventTypes).map(([siteId, types]) => {
              const site = sites?.find((s) => s.id === siteId)
              return (
                <div key={siteId} className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                      {site?.name || "No Site Assigned"}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {types.map((et) => {
                      const isEditing = editingEventType?.id === et.id
                      const bookingUrl = getBookingUrl(et)

                      return (
                        <SectionCard
                          key={et.id}
                          className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden"
                        >
                          <SectionCardHeader
                            className="cursor-pointer hover:bg-muted/50 transition-colors group"
                            onClick={() =>
                              isEditing ? setEditingEventType(null) : setEditingEventType(et)
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <SectionCardTitle className="text-lg font-semibold truncate">
                                      {et.title}
                                    </SectionCardTitle>
                                    {!et.enabled && (
                                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground uppercase font-bold tracking-tighter">
                                        Disabled
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1.5 shrink-0">
                                      {et.duration} min
                                    </span>
                                    <div
                                      className="flex items-center gap-1.5 min-w-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Link className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate hover:text-primary transition-colors cursor-pointer">
                                        {bookingUrl}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                        onClick={() => handleCopyUrl(bookingUrl)}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {isEditing ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </SectionCardHeader>

                          {isEditing && editingEventType && (
                            <>
                              <SectionCardContent className="space-y-4 border-t border-border">
                                <EventTypeFields
                                  value={editingEventType}
                                  onChange={setEditingEventType}
                                  sites={sites}
                                  enabledId={`et-enabled-${et.id}`}
                                />
                              </SectionCardContent>
                              <ActionFooter>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteEventType(et.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Event
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => handleSaveEventType()}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? "Saving..." : "Save Event Type"}
                                  </Button>
                                </div>
                              </ActionFooter>
                            </>
                          )}
                        </SectionCard>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
