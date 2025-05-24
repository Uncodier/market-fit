"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, User, Mail, FileText, CheckCircle2, Clock, Save } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { siteMembersService, type SiteMember } from "@/app/services/site-members-service"
import { ActionFooter } from "../ui/card-footer"
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

interface TeamSectionProps {
  active: boolean
  siteId?: string
}

const TEAM_ROLES = [
  { value: "view", label: "Viewer (View only)", siteMemberRole: "collaborator" },
  { value: "create", label: "Editor (Create and edit)", siteMemberRole: "marketing" },
  { value: "delete", label: "Manager (Full access)", siteMemberRole: "marketing" },
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
}

// Helper to convert SiteMember to FormTeamMember
const siteMemberToFormMember = (member: SiteMember): FormTeamMember => {
  // Map site_members role to form role
  let formRole: TeamRole = "view";
  switch (member.role) {
    case "admin": formRole = "admin"; break;
    case "marketing": formRole = "create"; break;
    case "collaborator": formRole = "view"; break;
    case "owner": formRole = "admin"; break; // Owner shows as admin in form
  }

  return {
    id: member.id,
    name: member.name || undefined,
    email: member.email,
    role: formRole,
    position: member.position || undefined,
    status: member.status,
    originalRole: member.role // Keep track of original DB role
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
  
  // Fetch site members from the site_members table when available
  useEffect(() => {
    // Ensure we fetch when the team tab becomes active or siteId changes
    if (!active || !siteId) return;
    
    // Don't overwrite local state if there are unsaved changes
    if (hasUnsavedChanges) return;
    
    const fetchSiteMembers = async () => {
      try {
        console.log("Fetching team members for site:", siteId);
        setIsLoading(true)
        
        // Try to get members from site_members table first
        const members = await siteMembersService.getMembers(siteId)
        
        // Convert ALL members (including owner/admin) to form format for display
        const formattedMembers = members.map(siteMemberToFormMember)
        
        console.log("Found site members:", formattedMembers);
        
        if (formattedMembers.length > 0) {
          // Use members from site_members table if available
          setTeamList(formattedMembers)
          updateFormValues(formattedMembers)
        } else {
          // If no members in site_members table, use settings.team_members as fallback
          const currentTeamMembers = form.getValues("team_members") || [];
          console.log("Using team members from settings:", currentTeamMembers);
          
          if (currentTeamMembers.length > 0) {
            setTeamList(currentTeamMembers)
          }
        }
      } catch (error) {
        console.error("Error fetching site members:", error)
        // We'll fall back to the values from team_members in settings
        const currentTeamMembers = form.getValues("team_members") || [];
        if (currentTeamMembers.length > 0) {
          console.log("Using fallback team members from settings:", currentTeamMembers);
          setTeamList(currentTeamMembers)
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSiteMembers()
  }, [active, siteId, hasUnsavedChanges, updateFormValues, form])

  // Add team member
  const addTeamMember = () => {
    if (isLoading) return
    const newTeamList = [...teamList, { 
      email: "", 
      role: "view" as TeamRole, 
      name: "", 
      position: "",
      // New members don't have originalRole since they're not in DB yet
    }]
    setTeamList(newTeamList)
    setHasUnsavedChanges(true)
    debouncedUpdateRef.current(newTeamList)
  }

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
      }
      
    } catch (error) {
      console.error("Error saving team members:", error);
      toast.error("Failed to save team members");
    } finally {
      setIsSaving(false);
    }
  };

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Team Members</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Invite team members to collaborate on your site
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          teamList.map((member, index) => (
            <div key={index} className="space-y-4 p-4 border border-border rounded-lg relative">
              {member.status && (
                <div className="absolute top-3 right-3">
                  {member.status === 'active' ? (
                    <Badge className="bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  ) : member.status === 'pending' ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-500">
                      <Clock className="h-3 w-3 mr-1" /> Pending
                    </Badge>
                  ) : null}
                </div>
              )}
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
                              // Update only the field itself without validation
                              field.onChange(e);
                              // Update local state and debounce form update
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
                            disabled={!!member.id} // If it's an existing site member, don't allow email change
                            value={teamList[index].email}
                            onChange={(e) => {
                              // Update only the field itself without validation
                              field.onChange(e);
                              // Update local state and debounce form update
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
                              // Update only the field itself without validation
                              field.onChange(e);
                              // Update local state and debounce form update
                              updateLocalTeamMember(index, 'position', e.target.value);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end space-x-4">
                  <FormField
                    control={form.control}
                    name={`team_members.${index}.role`}
                    defaultValue={member.role}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-sm font-medium">Role</FormLabel>
                        <Select
                          value={teamList[index].role}
                          onValueChange={(value) => {
                            // Use validation hook
                            if (validation.canChangeRole(member)) {
                              // Update the field directly
                              field.onChange(value);
                              // Update local state and debounce form update
                              updateLocalTeamMember(index, 'role', value as TeamRole);
                            } else {
                              toast.error(validation.getRoleChangeMessage(member));
                            }
                          }}
                          disabled={!validation.canChangeRole(member)}
                        >
                          <FormControl>
                            <SelectTrigger className={`h-12 ${!validation.canChangeRole(member) ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        className="h-12 w-12 mt-2"
                        disabled={isLoading || !validation.canDelete(member)}
                        title={validation.getDeleteTooltip(member)}
                      >
                        <Trash2 className="h-5 w-5" />
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
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            Remove Member
                          </AlertDialogAction>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
        <Button
          variant="outline"
          className="mt-2 w-full h-12"
          type="button"
          onClick={addTeamMember}
          disabled={isLoading}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Team Member
        </Button>
        <div className="text-sm text-muted-foreground mt-4">
          <p>Team members will receive an email invitation to join your site.</p>
          <p className="mt-1">Site owners and admins can manage access and permissions.</p>
        </div>
      </CardContent>
      
      {hasUnsavedChanges && (
        <ActionFooter>
          <Button
            type="button"
            onClick={handleSaveTeamMembers}
            disabled={isSaving || isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Team Members"}
          </Button>
        </ActionFooter>
      )}
    </Card>
  )
} 