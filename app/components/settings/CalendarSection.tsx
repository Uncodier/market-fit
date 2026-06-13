"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Plus, PlusCircle, Trash2, Calendar as CalendarIcon, Users, Clock, Link as LinkIcon, Copy, Edit, ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useSite, RoundRobinCalendar } from "@/app/context/SiteContext"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Checkbox } from "@/app/components/ui/checkbox"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { siteMembersService } from "@/app/services/site-members-service"
import { useAuth } from "@/app/hooks/use-auth"

export function CalendarSection() {
  const { currentSite, updateSettings } = useSite()
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  
  const calendars = currentSite?.settings?.calendars || []
  const [teamMembers, setTeamMembers] = useState<{name: string, email: string}[]>([])

  React.useEffect(() => {
    let mounted = true;
    if (currentSite?.id) {
      siteMembersService.getMembers(currentSite.id).then(members => {
        if (!mounted) return;
        const formattedMembers = members.map(m => ({ email: m.email, name: m.name || m.email }));
        
        // Ensure current user is in the list just in case
        if (user?.email && !formattedMembers.some(m => m.email === user.email)) {
          formattedMembers.unshift({ email: user.email, name: user.user_metadata?.name || user.email });
        }
        
        setTeamMembers(formattedMembers);
      }).catch(err => {
        console.error("Error fetching site members:", err);
        // Fallback
        if (mounted) {
          const fallback = currentSite.settings?.team_members || [];
          if (user?.email && !fallback.some(m => m.email === user.email)) {
            setTeamMembers([{ email: user.email, name: user.user_metadata?.name || user.email }, ...fallback]);
          } else {
            setTeamMembers(fallback);
          }
        }
      });
    }
    return () => { mounted = false; };
  }, [currentSite?.id, currentSite?.settings?.team_members, user?.email, user?.user_metadata?.name]);

  const [editingCalendar, setEditingCalendar] = useState<Partial<RoundRobinCalendar> | null>(null)

  const handleAddCalendar = () => {
    setEditingCalendar({
      id: crypto.randomUUID(),
      name: "",
      slug: "",
      member_ids: [],
      duration: 30,
      buffer: 15,
      created_at: new Date().toISOString()
    })
  }

  const handleSaveCalendar = async () => {
    if (!editingCalendar?.name || !editingCalendar?.slug) {
      toast.error("Please provide a name and slug for the calendar")
      return
    }

    if (editingCalendar.member_ids?.length === 0) {
      toast.error("Please select at least one team member")
      return
    }

    setIsUpdating(true)
    try {
      const updatedCalendars = calendars.some(c => c.id === editingCalendar.id)
        ? calendars.map(c => c.id === editingCalendar.id ? editingCalendar as RoundRobinCalendar : c)
        : [...calendars, editingCalendar as RoundRobinCalendar]

      if (currentSite?.id) {
        await updateSettings(currentSite.id, {
          ...currentSite?.settings,
          calendars: updatedCalendars
        })
      }
      
      setEditingCalendar(null)
      toast.success("Calendar saved successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to save calendar")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteCalendar = async (id: string) => {
    if (!confirm("Are you sure you want to delete this calendar?")) return

    setIsUpdating(true)
    try {
      const updatedCalendars = calendars.filter(c => c.id !== id)
      if (currentSite?.id) {
        await updateSettings(currentSite.id, {
          ...currentSite?.settings,
          calendars: updatedCalendars
        })
      }
      toast.success("Calendar deleted successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete calendar")
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleMember = (email: string) => {
    if (!editingCalendar) return
    const currentMembers = editingCalendar.member_ids || []
    const newMembers = currentMembers.includes(email)
      ? currentMembers.filter(m => m !== email)
      : [...currentMembers, email]
    
    setEditingCalendar({ ...editingCalendar, member_ids: newMembers })
  }

  const handleCopyUrl = (slug: string) => {
    const siteSlug = getSiteSlug()
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}/book/${siteSlug}/rr/${slug}` 
      : `/book/${siteSlug}/rr/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }

  const getSiteSlug = () => {
    return currentSite?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || currentSite?.id || "default"
  }

  return (
    <div id="calendars" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-foreground" />
            Calendars
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create shared booking pages that assign meetings to team members.
          </p>
        </div>
        {!editingCalendar && (
          <Button onClick={handleAddCalendar} size="sm" variant="outline" className="gap-2">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Calendar
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {/* New Calendar Form */}
        {editingCalendar && !calendars.some(c => c.id === editingCalendar.id) && (
          <Card className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-lg font-semibold">New Calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t border-border">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground" htmlFor="rr-name-new">Calendar Name</Label>
                  <Input 
                    id="rr-name-new" 
                    placeholder="Sales Demo" 
                    className="bg-background h-12 text-base"
                    value={editingCalendar.name || ""}
                    onChange={(e) => setEditingCalendar({ ...editingCalendar, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground" htmlFor="rr-slug-new">URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">/book/.../rr/</span>
                    <Input 
                      id="rr-slug-new" 
                      placeholder="sales-demo" 
                      className="bg-background h-12 text-base"
                      value={editingCalendar.slug || ""}
                      onChange={(e) => setEditingCalendar({ ...editingCalendar, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground" htmlFor="rr-duration-new">Meeting Duration (min)</Label>
                  <Input 
                    id="rr-duration-new" 
                    type="number"
                    className="bg-background h-12 text-base"
                    value={editingCalendar.duration || 30}
                    onChange={(e) => setEditingCalendar({ ...editingCalendar, duration: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground" htmlFor="rr-buffer-new">Buffer (min)</Label>
                  <Input 
                    id="rr-buffer-new" 
                    type="number"
                    className="bg-background h-12 text-base"
                    value={editingCalendar.buffer || 0}
                    onChange={(e) => setEditingCalendar({ ...editingCalendar, buffer: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold text-muted-foreground" htmlFor="rr-location-new">Meeting Room / Location URL</Label>
                <Input 
                  id="rr-location-new" 
                  placeholder="https://meet.google.com/xxx-xxxx-xxx or physical location"
                  className="bg-background h-12 text-base"
                  value={editingCalendar.location || ""}
                  onChange={(e) => setEditingCalendar({ ...editingCalendar, location: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground">Assign Team Members</Label>
                <div className="grid gap-2 border border-border rounded-md p-4 bg-background max-h-60 overflow-y-auto">
                  {teamMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No team members found. Add them in the Team tab.</p>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.email} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`member-new-${member.email}`} 
                          checked={editingCalendar.member_ids?.includes(member.email)}
                          onCheckedChange={() => toggleMember(member.email)}
                        />
                        <Label 
                          htmlFor={`member-new-${member.email}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {member.name || member.email} <span className="text-muted-foreground">({member.email})</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
            
            <ActionFooter>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEditingCalendar(null)}>Cancel</Button>
                <Button variant="outline" onClick={handleSaveCalendar} disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Create Calendar"}
                </Button>
              </div>
            </ActionFooter>
          </Card>
        )}

        {calendars.length === 0 && !editingCalendar ? (
          <div className="py-6">
            <EmptyCard 
              icon={<CalendarIcon />}
              title="No calendars yet"
              description="Create your first booking page to start scheduling."
            />
          </div>
        ) : (
          calendars.map((calendar) => {
            const isEditing = editingCalendar?.id === calendar.id
            const bookingUrl = `/book/${getSiteSlug()}/rr/${calendar.slug}`
            
            return (
              <Card 
                key={calendar.id} 
                className="border dark:border-white/5 border-black/5 shadow-none overflow-hidden"
              >
                {/* Summary View */}
                <CardHeader 
                  className="px-8 py-6 cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => isEditing ? setEditingCalendar(null) : setEditingCalendar(calendar)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold truncate">{calendar.name}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1.5 shrink-0">
                            {calendar.member_ids?.length || 0} members
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {calendar.duration} min
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate hover:text-primary transition-colors cursor-pointer">{bookingUrl}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ml-1" 
                              onClick={() => handleCopyUrl(calendar.slug)}
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
                </CardHeader>

                {/* Edit Form (Expanded) */}
                {isEditing && (
                  <>
                    <CardContent className="space-y-6 px-8 pt-8 pb-8 border-t border-border">
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold text-muted-foreground" htmlFor={`rr-name-${calendar.id}`}>Calendar Name</Label>
                          <Input 
                            id={`rr-name-${calendar.id}`} 
                            placeholder="Sales Demo" 
                            className="bg-background h-12 text-base"
                            value={editingCalendar.name || ""}
                            onChange={(e) => setEditingCalendar({ ...editingCalendar, name: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold text-muted-foreground" htmlFor={`rr-slug-${calendar.id}`}>URL Slug</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">/book/.../rr/</span>
                            <Input 
                              id={`rr-slug-${calendar.id}`} 
                              placeholder="sales-demo" 
                              className="bg-background h-12 text-base"
                              value={editingCalendar.slug || ""}
                              onChange={(e) => setEditingCalendar({ ...editingCalendar, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold text-muted-foreground" htmlFor={`rr-duration-${calendar.id}`}>Meeting Duration (min)</Label>
                          <Input 
                            id={`rr-duration-${calendar.id}`} 
                            type="number"
                            className="bg-background h-12 text-base"
                            value={editingCalendar.duration || 30}
                            onChange={(e) => setEditingCalendar({ ...editingCalendar, duration: parseInt(e.target.value) || 30 })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold text-muted-foreground" htmlFor={`rr-buffer-${calendar.id}`}>Buffer (min)</Label>
                          <Input 
                            id={`rr-buffer-${calendar.id}`} 
                            type="number"
                            className="bg-background h-12 text-base"
                            value={editingCalendar.buffer || 0}
                            onChange={(e) => setEditingCalendar({ ...editingCalendar, buffer: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold text-muted-foreground" htmlFor={`rr-location-${calendar.id}`}>Meeting Room / Location URL</Label>
                        <Input 
                          id={`rr-location-${calendar.id}`} 
                          placeholder="https://meet.google.com/xxx-xxxx-xxx or physical location"
                          className="bg-background h-12 text-base"
                          value={editingCalendar.location || ""}
                          onChange={(e) => setEditingCalendar({ ...editingCalendar, location: e.target.value })}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground">Assign Team Members</Label>
                        <div className="grid gap-2 border border-border rounded-md p-4 bg-background max-h-60 overflow-y-auto">
                          {teamMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No team members found. Add them in the Team tab.</p>
                          ) : (
                            teamMembers.map((member) => (
                              <div key={member.email} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`member-${calendar.id}-${member.email}`} 
                                  checked={editingCalendar.member_ids?.includes(member.email)}
                                  onCheckedChange={() => toggleMember(member.email)}
                                />
                                <Label 
                                  htmlFor={`member-${calendar.id}-${member.email}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {member.name || member.email} <span className="text-muted-foreground">({member.email})</span>
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                    
                    <ActionFooter>
                      <div className="flex items-center gap-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCalendar(calendar.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Calendar
                        </Button>
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => handleSaveCalendar()} 
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Saving..." : "Save Calendar"}
                        </Button>
                      </div>
                    </ActionFooter>
                  </>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
