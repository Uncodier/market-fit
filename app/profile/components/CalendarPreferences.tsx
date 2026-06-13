"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
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
import * as Icons from "@/app/components/ui/icons"
import { Calendar, Clock, Link, PlusCircle, Trash2, Plus, Edit, Copy, ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { CalendarSettings, EventType } from "@/app/services/profile.service"
import { useSite } from "@/app/context/SiteContext"

interface CalendarPreferencesProps {
  settings?: CalendarSettings
  onSave: (settings: CalendarSettings) => Promise<void>
  isUpdating: boolean
  userEmail?: string
}

const DAYS = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
]

export function CalendarPreferences({ settings, onSave, isUpdating, userEmail }: CalendarPreferencesProps) {
  const { sites } = useSite()
  const defaultSlug = userEmail ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-') : ""
  
  const [formData, setFormData] = useState<CalendarSettings>({
    enabled: false,
    availability: DAYS.reduce((acc, day) => ({
      ...acc,
      [day.id]: { enabled: day.id !== "saturday" && day.id !== "sunday", start: "09:00", end: "17:00" }
    }), {}),
    event_types: [],
    respect_holidays: false,
    timezone: "America/Mexico_City",
    schedule_name: "Sinergia México"
  })

  const timeOptions = Array.from({ length: 48 }).map((_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hours}:${minutes}`;
  });

  const [editingEventType, setEditingEventType] = useState<Partial<EventType> | null>(null)

  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        event_types: settings.event_types || []
      })
    }
  }, [settings])

  const handleToggleDay = (dayId: string) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayId]: { ...prev.availability[dayId], enabled: !prev.availability[dayId].enabled }
      }
    }))
  }

  const handleTimeChange = (dayId: string, field: "start" | "end", value: string) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayId]: { ...prev.availability[dayId], [field]: value }
      }
    }))
  }

  const handleSave = async () => {
    await onSave(formData)
  }

  const handleAddEventType = () => {
    setEditingEventType({
      id: crypto.randomUUID(),
      title: "",
      slug: "",
      duration: 30,
      buffer: 15,
      enabled: true,
      site_id: sites?.[0]?.id || ""
    })
  }

  const handleSaveEventType = async () => {
    if (!editingEventType?.title || !editingEventType?.slug) {
      toast.error("Title and slug are required")
      return
    }

    const updatedEventTypes = formData.event_types?.some(et => et.id === editingEventType.id)
      ? formData.event_types.map(et => et.id === editingEventType.id ? editingEventType as EventType : et)
      : [...(formData.event_types || []), editingEventType as EventType]

    const newFormData = { ...formData, event_types: updatedEventTypes }
    setFormData(newFormData)
    setEditingEventType(null)
    
    await onSave(newFormData)
  }

  const handleDeleteEventType = async (id: string) => {
    const updatedEventTypes = formData.event_types?.filter(et => et.id !== id)
    const newFormData = { ...formData, event_types: updatedEventTypes }
    
    setFormData(newFormData)
    await onSave(newFormData)
  }

  const getSiteName = (siteId?: string) => {
    const site = sites?.find(s => s.id === siteId)
    return site?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || "default"
  }

  const getBookingUrl = (et: EventType) => {
    const siteSlug = getSiteName(et.site_id)
    const userSlug = defaultSlug
    return typeof window !== 'undefined' 
      ? `${window.location.origin}/book/${siteSlug}/${userSlug}/${et.slug}` 
      : `/book/${siteSlug}/${userSlug}/${et.slug}`
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }

  const groupedEventTypes = formData.event_types?.reduce((acc, et) => {
    const siteId = et.site_id || "default"
    if (!acc[siteId]) acc[siteId] = []
    acc[siteId].push(et)
    return acc
  }, {} as Record<string, EventType[]>)

  return (
    <div className="space-y-12">
      {/* Global Enable Switch */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-accent/5">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Global Calendar Enabled</Label>
          <p className="text-sm text-muted-foreground">Master switch for all your booking links</p>
        </div>
        <Switch 
          checked={formData.enabled} 
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))} 
        />
      </div>

      {/* Business Hours Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Business Hours</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define your business hours for different regions and locations
            </p>
          </div>
          <Button variant="outline" className="gap-2 rounded-full">
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </div>

        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border bg-background flex flex-row items-center gap-4 space-y-0">
            <Input 
              className="flex-1 max-w-[300px]" 
              value={formData.schedule_name || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule_name: e.target.value }))}
              placeholder="Schedule Name"
            />
            <Select 
              value={formData.timezone || "America/Mexico_City"}
              onValueChange={(v) => setFormData(prev => ({ ...prev, timezone: v }))}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">Mexico City (GMT-6)</SelectItem>
                <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="ghost" size="icon">
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Respect Holidays</Label>
                <p className="text-sm text-muted-foreground">Agents will not work on regional holidays when enabled</p>
              </div>
              <Switch 
                checked={formData.respect_holidays || false} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, respect_holidays: checked }))} 
              />
            </div>

            <div className="space-y-3">
              {DAYS.map((day) => (
                <div key={day.id} className="flex items-center p-3 rounded-lg border border-border gap-8">
                  <div className="flex items-center gap-4 w-32">
                    <Switch 
                      checked={formData.availability[day.id]?.enabled} 
                      onCheckedChange={() => handleToggleDay(day.id)} 
                    />
                    <span className={cn("min-w-[80px]", formData.availability[day.id]?.enabled ? "font-medium text-foreground" : "text-foreground font-medium")}>
                      {day.label}
                    </span>
                  </div>
                  
                  {formData.availability[day.id]?.enabled ? (
                    <div className="flex items-center gap-4">
                      <Select
                        value={formData.availability[day.id].start}
                        onValueChange={(value) => handleTimeChange(day.id, "start", value)}
                      >
                        <SelectTrigger className="w-[140px] h-10 bg-background shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-sm font-medium">to</span>
                      <Select
                        value={formData.availability[day.id].end}
                        onValueChange={(value) => handleTimeChange(day.id, "end", value)}
                      >
                        <SelectTrigger className="w-[140px] h-10 bg-background shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <ActionFooter>
            <div className="flex items-center justify-end gap-4 w-full">
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/20 hover:text-destructive hover:bg-destructive/10 rounded-full px-6"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Schedule
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={isUpdating}
                className="rounded-full px-6 border-foreground/20 font-medium"
              >
                {isUpdating ? "Saving..." : "Save Schedule"}
              </Button>
            </div>
          </ActionFooter>
        </Card>
      </div>

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
          {/* New Event Type Form */}
          {editingEventType && !formData.event_types?.some(et => et.id === editingEventType.id) && (
            <Card className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden mb-4">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-lg font-semibold">New Event Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t border-border">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Title</Label>
                    <Input 
                      className="bg-background h-12 text-base"
                      value={editingEventType.title || ""} 
                      onChange={e => setEditingEventType({...editingEventType, title: e.target.value})} 
                      placeholder="30 Minute Meeting"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">/book/.../</span>
                      <Input 
                        className="bg-background h-12 text-base"
                        value={editingEventType.slug || ""} 
                        onChange={e => setEditingEventType({...editingEventType, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} 
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
                        value={editingEventType.duration || 30} 
                        onChange={e => setEditingEventType({...editingEventType, duration: parseInt(e.target.value) || 30})} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Buffer (min)</Label>
                      <Input 
                        className="bg-background h-12 text-base"
                        type="number" 
                        value={editingEventType.buffer || 0} 
                        onChange={e => setEditingEventType({...editingEventType, buffer: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Meeting Room / Location URL</Label>
                    <Input 
                      className="bg-background h-12 text-base"
                      value={editingEventType.location || ""} 
                      onChange={e => setEditingEventType({...editingEventType, location: e.target.value})} 
                      placeholder="https://meet.google.com/xxx-xxxx-xxx or physical location"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Site Dependency</Label>
                  <Select 
                    value={editingEventType.site_id} 
                    onValueChange={v => setEditingEventType({...editingEventType, site_id: v})}
                  >
                    <SelectTrigger className="bg-background h-12 text-base">
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map(site => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch 
                    id="new-et-enabled" 
                    checked={editingEventType.enabled} 
                    onCheckedChange={v => setEditingEventType({...editingEventType, enabled: v})} 
                  />
                  <Label htmlFor="new-et-enabled" className="text-sm cursor-pointer">Enabled</Label>
                </div>
              </CardContent>
              <ActionFooter>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setEditingEventType(null)}>Cancel</Button>
                  <Button variant="outline" onClick={handleSaveEventType} disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Create Event Type"}
                  </Button>
                </div>
              </ActionFooter>
            </Card>
          )}

          {formData.event_types?.length === 0 && !editingEventType ? (
            <div className="py-6">
              <EmptyCard 
                icon={<Clock />}
                title="No event types configured yet"
                description="Create event types to manage your booking links and meeting availability."
              />
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedEventTypes || {}).map(([siteId, eventTypes]) => {
                const site = sites?.find(s => s.id === siteId)
                return (
                  <div key={siteId} className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        {site?.name || "No Site Assigned"}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {eventTypes.map((et) => {
                        const isEditing = editingEventType?.id === et.id
                        const bookingUrl = getBookingUrl(et)
                        
                        return (
                          <Card 
                            key={et.id} 
                            className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden"
                          >
                            {/* Summary View */}
                            <CardHeader 
                              className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors group"
                              onClick={() => isEditing ? setEditingEventType(null) : setEditingEventType(et)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg font-semibold truncate">{et.title}</CardTitle>
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
                                      <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                                        <Link className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate hover:text-primary transition-colors cursor-pointer">{bookingUrl}</span>
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
                                    <Icons.ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <Icons.ChevronRight className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CardHeader>

                            {/* Edit Form (Expanded) */}
                            {isEditing && (
                              <>
                                <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t border-border">
                                  <div className="grid gap-5 md:grid-cols-2">
                                    <div className="grid gap-2">
                                      <Label className="text-xs font-semibold text-muted-foreground">Title</Label>
                                      <Input 
                                        className="bg-background h-12 text-base"
                                        value={editingEventType.title || ""} 
                                        onChange={e => setEditingEventType({...editingEventType, title: e.target.value})} 
                                        placeholder="30 Minute Meeting"
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <Label className="text-xs font-semibold text-muted-foreground">URL Slug</Label>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">/book/.../</span>
                                        <Input 
                                          className="bg-background h-12 text-base"
                                          value={editingEventType.slug || ""} 
                                          onChange={e => setEditingEventType({...editingEventType, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} 
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
                        value={editingEventType.duration || 30} 
                        onChange={e => setEditingEventType({...editingEventType, duration: parseInt(e.target.value) || 30})} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Buffer (min)</Label>
                      <Input 
                        className="bg-background h-12 text-base"
                        type="number" 
                        value={editingEventType.buffer || 0} 
                        onChange={e => setEditingEventType({...editingEventType, buffer: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Meeting Room / Location URL</Label>
                    <Input 
                      className="bg-background h-12 text-base"
                      value={editingEventType.location || ""} 
                      onChange={e => setEditingEventType({...editingEventType, location: e.target.value})} 
                      placeholder="https://meet.google.com/xxx-xxxx-xxx or physical location"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Site Dependency</Label>
                                    <Select 
                                      value={editingEventType.site_id} 
                                      onValueChange={v => setEditingEventType({...editingEventType, site_id: v})}
                                    >
                                      <SelectTrigger className="bg-background h-12 text-base">
                                        <SelectValue placeholder="Select a site" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {sites?.map(site => (
                                          <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex items-center space-x-2 pt-2">
                                    <Switch 
                                      id={`et-enabled-${et.id}`} 
                                      checked={editingEventType.enabled} 
                                      onCheckedChange={v => setEditingEventType({...editingEventType, enabled: v})} 
                                    />
                                      <Label htmlFor={`et-enabled-${et.id}`} className="text-sm cursor-pointer">Enabled</Label>
                                  </div>
                                </CardContent>
                                
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
                                        type="button"
                                        variant="outline" 
                                        onClick={() => handleSaveEventType()}
                                        disabled={isUpdating}
                                      >
                                        {isUpdating ? "Saving..." : "Save Event Type"}
                                      </Button>
                                  </div>
                                </ActionFooter>
                              </>
                            )}
                          </Card>
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
    </div>
  )
}
