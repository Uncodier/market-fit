"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, User, Mail, FileText, CheckCircle2, Clock, Save, RotateCcw, Loader, ChevronDown, ChevronUp } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { siteMembersService, type SiteMember } from "@/app/services/site-members-service"
import { useTeamMemberValidation } from "@/app/hooks/useTeamMemberValidation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog"
import { resendMagicLinkInvitation } from "@/app/services/magic-link-invitation-service"

interface TeamSectionProps {
  active: boolean
  siteId?: string
}

const TEAM_ROLES = [
  { value: "view", label: "Viewer (View only)", siteMemberRole: "marketing" },
  { value: "create", label: "Editor (Create and edit)", siteMemberRole: "collaborator" },
  { value: "delete", label: "Manager (Full access)", siteMemberRole: "collaborator" },
  { value: "admin", label: "Admin (Owner privileges)", siteMemberRole: "admin" }
]

type TeamRole = "view" | "create" | "delete" | "admin";

interface FormTeamMember {
  name?: string;
  email: string;
  role: TeamRole;
  position?: string;
  id?: string;
  status?: 'pending' | 'active' | 'rejected';
  originalRole?: 'owner' | 'admin' | 'marketing' | 'collaborator'; // Track original DB role
  emailConfirmed?: boolean; // Track if user has confirmed their email
  lastSignIn?: string; // Track last sign in to know if user is truly active
}

// Helper to convert SiteMember to FormTeamMember
const siteMemberToFormMember = (member: SiteMember): FormTeamMember => {
  // Map site_members role to form role
  let formRole: TeamRole = "view";
  switch (member.role) {
    case "admin": formRole = "admin"; break;
    case "marketing": formRole = "view"; break;        // Viewer role -> SELECT only
    case "collaborator": formRole = "create"; break;   // Editor role -> SELECT, INSERT, UPDATE
    case "owner": formRole = "admin"; break; // Owner shows as admin in form
  }

  return {
    id: member.id,
    name: member.name || undefined,
    email: member.email,
    role: formRole,
    position: member.position || undefined,
    status: member.status,
    originalRole: member.role, // Keep track of original DB role
    emailConfirmed: member.emailConfirmed,
    lastSignIn: member.lastSignIn
  };
};

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(fn: F, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(this: any, ...args: Parameters<F>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function TeamSection({ active, siteId }: TeamSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [teamList, setTeamList] = useState<FormTeamMember[]>(
    form.getValues("team_members") || []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isResending, setIsResending] = useState<string | null>(null) // Track which member is being resent
  const [isSavingMember, setIsSavingMember] = useState<string | null>(null) // Track which member is being saved
  const [originalMembers, setOriginalMembers] = useState<Map<string, FormTeamMember>>(new Map()) // Track original values
  const debouncedUpdateRef = useRef<any>(null)
  
  // Use our validation hook
  const validation = useTeamMemberValidation(teamList)
  
  // Create a debounced version of updateFormValues
  const updateFormValues = useCallback((newTeamList: FormTeamMember[]) => {
    form.setValue("team_members", newTeamList, { 
      shouldDirty: true,
      shouldTouch: true,
      // Only validate on final submission to avoid constant validation
      shouldValidate: false 
    })
  }, [form])
  
  // Initialize debounced function only once
  useEffect(() => {
    debouncedUpdateRef.current = debounce((newTeamList: FormTeamMember[]) => {
      updateFormValues(newTeamList);
    }, 300);
  }, [updateFormValues]);
  
  // Emit team members update event whenever teamList changes
  useEffect(() => {
    if (active && teamList.length > 0) {
      const teamMembersData = teamList.map((member, index) => ({
        id: `team-member-${index}`,
        title: member.name || member.email || `Member ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('teamMembersUpdated', { 
        detail: teamMembersData 
      }));
    }
  }, [active, teamList]);

  // Sync originalMembers with teamList when members with IDs are present
  useEffect(() => {
    if (teamList.length > 0) {
      setOriginalMembers(prev => {
        const newOriginalMap = new Map(prev)
        let hasUpdates = false
        
        teamList.forEach(member => {
          if (member.id && !newOriginalMap.has(member.id)) {
            // Add member to original map if it has an ID and isn't already tracked
            newOriginalMap.set(member.id, { ...member })
            hasUpdates = true
          }
        })
        
        return hasUpdates ? newOriginalMap : prev
      })
    }
  }, [teamList])

  // Fetch site members from the site_members table when the component becomes active
  useEffect(() => {
    // Only fetch when team tab becomes active and we have a siteId
    if (!active || !siteId) return;
    
    // Don't overwrite local state if there are unsaved changes
    if (hasUnsavedChanges) return;
    
    // Create a flag to prevent state updates if component unmounts
    let isMounted = true;
    
    const fetchSiteMembers = async () => {
      try {
        console.log("Fetching team members for site:", siteId);
        setIsLoading(true)
        
        // Try to get members from site_members table first
        const members = await siteMembersService.getMembers(siteId)
        
        if (!isMounted) return; // Component unmounted, don't update state
        
        // Convert ALL members (including owner/admin) to form format for display
        const formattedMembers = members.map(siteMemberToFormMember)
        
        console.log("Found site members:", formattedMembers);
        
        if (formattedMembers.length > 0) {
          // Use members from site_members table if available
          setTeamList(formattedMembers)
          updateFormValues(formattedMembers)
          // Store original values for change detection
          const originalMap = new Map<string, FormTeamMember>()
          formattedMembers.forEach(member => {
            if (member.id) {
              originalMap.set(member.id, { ...member })
            }
          })
          setOriginalMembers(originalMap)
        } else {
          // If no members in site_members table, use settings.team_members as fallback
          const currentTeamMembers = form.getValues("team_members") || [];
          console.log("Using team members from settings:", currentTeamMembers);
          
          if (currentTeamMembers.length > 0) {
            setTeamList(currentTeamMembers)
          }
        }
      } catch (error) {
        if (!isMounted) return; // Component unmounted, don't update state
        
        console.error("Error fetching site members:", error)
        // We'll fall back to the values from team_members in settings
        const currentTeamMembers = form.getValues("team_members") || [];
        if (currentTeamMembers.length > 0) {
          console.log("Using fallback team members from settings:", currentTeamMembers);
          setTeamList(currentTeamMembers)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    
    fetchSiteMembers()
    
    return () => {
      isMounted = false;
    }
  }, [active, siteId, hasUnsavedChanges]) // Removed updateFormValues and form from dependencies

  // Add team member
  const addTeamMember = useCallback(() => {
    if (isLoading) return
    const newTeamList = [{ 
      email: "", 
      role: "view" as TeamRole, 
      name: "", 
      position: "",
      // New members don't have originalRole since they're not in DB yet
    }, ...teamList]
    setTeamList(newTeamList)
    setHasUnsavedChanges(true)
    debouncedUpdateRef.current(newTeamList)
  }, [isLoading, teamList])

  // Remove team member
  const removeTeamMember = async (index: number) => {
    if (isLoading) return
    const memberToRemove = teamList[index]
    
    // If this is an actual site member with an ID, remove it from the database
    if (siteId && memberToRemove.id) {
      try {
        setIsLoading(true)
        await siteMembersService.removeMember(memberToRemove.id)
        toast.success(`${memberToRemove.name || memberToRemove.email} removed from team`)
        
        // Reload the team list after successful deletion
        const members = await siteMembersService.getMembers(siteId)
        const formattedMembers = members.map(siteMemberToFormMember)
        setTeamList(formattedMembers)
        updateFormValues(formattedMembers)
        setHasUnsavedChanges(false)
        // Update original members map
        const updatedOriginalMap = new Map<string, FormTeamMember>()
        formattedMembers.forEach(m => {
          if (m.id) {
            updatedOriginalMap.set(m.id, { ...m })
          }
        })
        setOriginalMembers(updatedOriginalMap)
        return
      } catch (error) {
        console.error("Error removing team member:", error)
        
        // Check if it's the database trigger preventing deletion of last admin
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Cannot delete the last admin or owner')) {
          toast.error("Cannot remove the last site admin. At least one admin must remain.");
        } else {
          toast.error("Failed to remove team member");
        }
        return
      } finally {
        setIsLoading(false)
      }
    }
    
    // For local-only members (no ID), just remove from local state
    const newTeamList = teamList.filter((_, i) => i !== index)
    setTeamList(newTeamList)
    setHasUnsavedChanges(newTeamList.some(member => !member.id && member.email.trim() !== ''))
    debouncedUpdateRef.current(newTeamList)
  }

  // Update a specific field of a team member - using local state only
  const updateLocalTeamMember = (index: number, field: keyof FormTeamMember, value: any) => {
    const newTeamList = [...teamList]
    newTeamList[index] = {
      ...newTeamList[index],
      [field]: value
    }
    setTeamList(newTeamList)
    setHasUnsavedChanges(true)
    debouncedUpdateRef.current(newTeamList)
  }

  // Check if a member has unsaved changes
  const hasMemberChanges = (member: FormTeamMember): boolean => {
    if (!member.id) return false // New members don't have original values
    
    const original = originalMembers.get(member.id)
    if (!original) {
      // If original not found, check if member exists in teamList with same ID
      // This handles the case where originalMembers hasn't been initialized yet
      return false
    }
    
    // Compare current values with original values
    const nameChanged = (member.name || '') !== (original.name || '')
    const positionChanged = (member.position || '') !== (original.position || '')
    const roleChanged = member.role !== original.role
    
    return nameChanged || positionChanged || roleChanged
  }

  // Check if a member has valid changes that can be saved
  const canSaveMember = (member: FormTeamMember): boolean => {
    if (!member.id || !hasMemberChanges(member)) return false
    
    const original = originalMembers.get(member.id)
    if (!original) return false
    
    // If role changed, check if role change is allowed
    if (member.role !== original.role) {
      return validation.canChangeRole(member)
    }
    
    // Name or position changes are always allowed (if member exists)
    return true
  }

  // Save individual member updates
  const handleSaveMember = async (member: FormTeamMember, index: number) => {
    if (!siteId || !member.id) {
      toast.error("Cannot save: member ID is required");
      return;
    }

    if (!hasMemberChanges(member)) {
      toast.info("No changes to save");
      return;
    }

    try {
      setIsSavingMember(member.id);
      
      // Map form role to site member role
      const siteMemberRole = member.role === 'admin' ? 'admin' : 
                            member.role === 'create' || member.role === 'delete' ? 'collaborator' : 
                            'marketing';
      
      // Update the member in the database
      await siteMembersService.updateMember(member.id, {
        role: siteMemberRole,
        name: member.name,
        position: member.position
      });

      toast.success(`${member.name || member.email} updated successfully`);
      
      // Update original values to reflect saved state
      const newOriginalMap = new Map(originalMembers)
      newOriginalMap.set(member.id, { ...member })
      setOriginalMembers(newOriginalMap)
      
      // Reload the team list to ensure consistency
      const members = await siteMembersService.getMembers(siteId);
      const formattedMembers = members.map(siteMemberToFormMember);
      setTeamList(formattedMembers);
      updateFormValues(formattedMembers);
      
      // Update original values map
      const updatedOriginalMap = new Map<string, FormTeamMember>()
      formattedMembers.forEach(m => {
        if (m.id) {
          updatedOriginalMap.set(m.id, { ...m })
        }
      })
      setOriginalMembers(updatedOriginalMap)
      
    } catch (error) {
      console.error("Error saving team member:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific error cases
      if (errorMessage.includes('Cannot change role of the last admin')) {
        toast.error("Cannot change role of the last admin or owner. At least one admin must remain.");
      } else {
        toast.error(`Failed to save changes: ${errorMessage}`);
      }
    } finally {
      setIsSavingMember(null);
    }
  };

  // Save team members function - direct Supabase operations
  const handleSaveTeamMembers = async () => {
    if (!siteId) {
      toast.error("Site ID is required");
      return;
    }

    try {
      setIsSaving(true);

      // Filter team members that need to be saved (have email and are new)
      const newMembers = teamList.filter(member => 
        member.email && 
        member.email.trim() !== '' && 
        !member.id // No ID means it's a new member
      );

      if (newMembers.length === 0) {
        toast.info("No new members to save");
        setHasUnsavedChanges(false);
        return;
      }

      // Save each new member directly to site_members table
      const savedMembers = [];
      for (const member of newMembers) {
        try {
          // Use siteMembersService.addMember directly
          const savedMember = await siteMembersService.addMember(siteId, {
            email: member.email,
            role: member.role === 'admin' ? 'admin' : 
                  member.role === 'create' || member.role === 'delete' ? 'marketing' : 
                  'collaborator',
            name: member.name,
            position: member.position
          });
          
          savedMembers.push(savedMember);
          
        } catch (memberError) {
          console.error(`Failed to save ${member.email}:`, memberError);
          const errorMessage = memberError instanceof Error ? memberError.message : 'Unknown error';
          toast.error(`Failed to save ${member.email}: ${errorMessage}`);
        }
      }

      if (savedMembers.length > 0) {
        toast.success(`Successfully added ${savedMembers.length} team member(s)!`);
        
        // Reload the team list to show the new members with their IDs and status
        const members = await siteMembersService.getMembers(siteId);
        const formattedMembers = members.map(siteMemberToFormMember);
        setTeamList(formattedMembers);
        updateFormValues(formattedMembers);
        setHasUnsavedChanges(false);
        // Update original members map
        const updatedOriginalMap = new Map<string, FormTeamMember>()
        formattedMembers.forEach(m => {
          if (m.id) {
            updatedOriginalMap.set(m.id, { ...m })
          }
        })
        setOriginalMembers(updatedOriginalMap)
      }
      
    } catch (error) {
      console.error("Error saving team members:", error);
      toast.error("Failed to save team members");
    } finally {
      setIsSaving(false);
    }
  };

  // Resend invitation function
  const handleResendInvitation = async (member: FormTeamMember, index: number) => {
    if (!siteId || !member.email || !member.id) {
      toast.error("Cannot resend invitation: missing required information");
      return;
    }

    try {
      setIsResending(member.id);
      
      // Get current site info for the invitation
      const currentSite = form.getValues(); // Get site info from form context
      const siteName = currentSite.name || "Your Site";
      
      // Map form role to invitation role (same logic as in site-members-service.ts addMember)
      let invitationRole: string = 'view';
      switch (member.role) {
        case 'admin': invitationRole = 'admin'; break;
        case 'create': 
        case 'delete': 
          invitationRole = 'create'; break;
        case 'view': 
        default: 
          invitationRole = 'view'; break;
      }
      
      const result = await resendMagicLinkInvitation({
        email: member.email,
        siteId: siteId,
        siteName: siteName,
        role: invitationRole,
        name: member.name,
        position: member.position
      });

      if (result.success) {
        toast.success(`Magic link invitation resent to ${member.name || member.email}`);
      } else {
        // Handle specific error types
        if (result.code === 'RATE_LIMIT_EXCEEDED') {
          toast.error(`Rate limit exceeded. Please wait ${result.retryAfter || 60} seconds before resending to ${member.email}`);
        } else if (result.code === 'SIGNUP_DISABLED') {
          toast.error("User registration is currently disabled. Please contact support.");
        } else {
          toast.error(result.error || "Failed to resend invitation");
        }
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast.error("Failed to resend invitation");
    } finally {
      setIsResending(null);
    }
  };

  // Get pending members for footer actions - show resend for users who haven't confirmed email OR haven't signed in
  const pendingMembers = teamList.filter(member => {
    const shouldShow = member.status === 'pending' && 
                      member.id && 
                      (!member.emailConfirmed || !member.lastSignIn);
    
    if (shouldShow) {
      console.log(`🔔 User ${member.email} eligible for invitation resend:`, {
        status: member.status,
        emailConfirmed: member.emailConfirmed,
        lastSignIn: member.lastSignIn
      });
    }
    
    return shouldShow;
  });

  if (!active) return null

  return (
    <div id="team-members" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Invite team members to collaborate on your site
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTeamMember}
          disabled={isLoading}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Invite New Member to Team
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
        <>
          {/* Team Member Cards */}
          {teamList.map((member, index) => (
            <Card 
              key={index} 
              id={`team-member-${index}`}
              className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold">
                        {member.name || member.email || "New Member"}
                      </CardTitle>
                      {member.position && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {member.position}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Role Badge */}
                    <Badge variant="secondary">
                      {TEAM_ROLES.find(role => role.value === member.role)?.label.split(' ')[0] || member.role}
                    </Badge>
                    
                    {/* Status Badge */}
                    {member.status && (
                      <>
                        {member.status === 'active' ? (
                          <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : member.status === 'pending' ? (
                          <>
                            {member.emailConfirmed ? (
                              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Email Confirmed
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200">
                                <Mail className="h-3 w-3 mr-1" /> Awaiting Email Click
                              </Badge>
                            )}
                            <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="px-8 pb-8">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`team_members.${index}.name`}
                      defaultValue={member.name || ""}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                className="pl-12 h-12 text-base"
                                placeholder="Full name"
                                {...field}
                                value={teamList[index].name || ""}
                                onChange={(e) => {
                                  field.onChange(e);
                                  updateLocalTeamMember(index, 'name', e.target.value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`team_members.${index}.email`}
                      defaultValue={member.email}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                className="pl-12 h-12 text-base"
                                placeholder="Email address"
                                type="email"
                                {...field}
                                disabled={!!member.id}
                                value={teamList[index].email}
                                onChange={(e) => {
                                  field.onChange(e);
                                  updateLocalTeamMember(index, 'email', e.target.value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`team_members.${index}.position`}
                      defaultValue={member.position || ""}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Position</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                className="pl-12 h-12 text-base"
                                placeholder="Job title"
                                {...field}
                                value={teamList[index].position || ""}
                                onChange={(e) => {
                                  field.onChange(e);
                                  updateLocalTeamMember(index, 'position', e.target.value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`team_members.${index}.role`}
                      defaultValue={member.role}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Role</FormLabel>
                          <Select
                            value={teamList[index].role}
                            onValueChange={(value) => {
                              if (validation.canChangeRole(member)) {
                                field.onChange(value);
                                updateLocalTeamMember(index, 'role', value as TeamRole);
                              } else {
                                toast.error(validation.getRoleChangeMessage(member));
                              }
                            }}
                            disabled={!validation.canChangeRole(member)}
                          >
                            <FormControl>
                              <SelectTrigger className={`h-11 ${!validation.canChangeRole(member) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TEAM_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!validation.canChangeRole(member) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ⚠️ {validation.getRoleChangeMessage(member)}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Resend Invitation Button (if pending) */}
                  {member.status === 'pending' && member.id && (!member.emailConfirmed || !member.lastSignIn) && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleResendInvitation(member, index)}
                        disabled={isLoading || isResending === member.id}
                        className="w-full"
                      >
                        {isResending === member.id ? (
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        Resend Magic Link Invitation
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
              
              <CardFooter className="px-8 py-6 bg-muted/30 border-t">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-muted-foreground">
                    {member.id ? (
                      <p>Member is {member.status === 'active' ? 'active' : 'pending invitation'}.</p>
                    ) : (
                      <p>Save to send invitation email to this member.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          type="button"
                          disabled={isLoading || !validation.canDelete(member)}
                          title={validation.getDeleteTooltip(member)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Member
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            {validation.getDeleteMessage(member)}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          {validation.canDelete(member) && (
                            <AlertDialogAction
                              onClick={() => removeTeamMember(index)}
                              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                            >
                              Remove Member
                            </AlertDialogAction>
                          )}
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {member.id && (
                      <Button
                        type="button"
                        onClick={() => handleSaveMember(member, index)}
                        disabled={isLoading || isSavingMember === member.id || !hasMemberChanges(member) || !canSaveMember(member)}
                        variant="outline"
                      >
                        {isSavingMember === member.id ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                    {!member.id && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveTeamMembers}
                        disabled={isSaving || isLoading || !member.email}
                      >
                        {isSaving ? "Saving..." : "Save & Invite"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </>
      )}
    </div>
  )
} 