"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

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
  const { t } = useLocalization()
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">{t("buyer.library.redeem.title")}</Label>
          <Input
            className="bg-background h-12 text-base"
            aria-label={t("buyer.library.redeem.title")}
            value={value.title || ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder={t("account.events.meetingPlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">{t("account.events.slug")}</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">/book/.../</span>
            <Input
              className="bg-background h-12 text-base"
              aria-label={t("account.events.slug")}
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
          <Label className="text-xs font-semibold text-muted-foreground">{t("account.events.duration")}</Label>
          <Input
            className="bg-background h-12 text-base"
            type="number"
            aria-label={t("account.events.duration")}
            value={value.duration || 30}
            onChange={(e) => onChange({ ...value, duration: parseInt(e.target.value) || 30 })}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">{t("account.events.buffer")}</Label>
          <Input
            className="bg-background h-12 text-base"
            type="number"
            aria-label={t("account.events.buffer")}
            value={value.buffer || 0}
            onChange={(e) => onChange({ ...value, buffer: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">{t("account.events.location")}</Label>
        <Input
          className="bg-background h-12 text-base"
          aria-label={t("account.events.location")}
          value={value.location || ""}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder={t("account.events.locationPlaceholder")}
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">{t("account.events.site")}</Label>
        <Select value={value.site_id} onValueChange={(v) => onChange({ ...value, site_id: v })}>
          <SelectTrigger aria-label={t("account.events.site")} className="bg-background h-12 text-base">
            <SelectValue placeholder={t("account.events.selectSite")} />
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
          {t("account.events.enabled")}
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
  const { t } = useLocalization()
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
      toast.error(t("account.events.required"))
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
    toast.success(t("account.events.copied"))
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
            {t("account.events.titlePlural")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("account.events.help")}
          </p>
        </div>
        {!editingEventType && (
          <Button onClick={handleAddEventType} size="sm" variant="outline" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {t("account.events.add")}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {isCreatingNew && editingEventType && (
          <SectionCard className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden mb-4">
            <SectionCardHeader>
              <SectionCardTitle className="text-lg font-semibold">{t("account.events.new")}</SectionCardTitle>
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
                  {t("common.cancel")}
                </Button>
                <Button variant="outline" onClick={handleSaveEventType} disabled={isUpdating} size="sm">
                  {isUpdating ? t("common.saving") : t("account.events.create")}
                </Button>
              </div>
            </ActionFooter>
          </SectionCard>
        )}

        {eventTypes.length === 0 && !editingEventType ? (
          <div className="py-6">
            <EmptyCard
              icon={<Clock />}
              title={t("account.events.empty")}
              description={t("account.events.emptyHelp")}
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
                      {site?.name || t("account.events.noSite")}
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
                                        {t("account.events.disabled")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1.5 shrink-0">
                                      {et.duration} {t("account.events.minutes")}
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
                                        aria-label={t("account.events.copyAria")}
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
                                    {t("account.events.remove")}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => handleSaveEventType()}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? t("common.saving") : t("account.events.save")}
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
