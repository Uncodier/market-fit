"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, User, Mail, FileText, CheckCircle2, Clock } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { siteMembersService, type SiteMember } from "@/app/services/site-members-service"

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
    status: member.status
  };
};

export function TeamSection({ active, siteId }: TeamSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [teamList, setTeamList] = useState<FormTeamMember[]>(
    form.getValues("team_members") || []
  )
  const [isLoading, setIsLoading] = useState(false)
  
  // Fetch site members from the site_members table when available
  useEffect(() => {
    if (!active || !siteId) return;
    
    const fetchSiteMembers = async () => {
      try {
        setIsLoading(true)
        const members = await siteMembersService.getMembers(siteId)
        
        // Filter out the owner for display in the form
        const formattedMembers = members
          .filter(member => member.role !== 'owner')
          .map(siteMemberToFormMember)
        
        setTeamList(formattedMembers)
        
        // Also update the form values to keep them in sync
        form.setValue("team_members", formattedMembers)
      } catch (error) {
        console.error("Error fetching site members:", error)
        // We'll fall back to the values from team_members in settings
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSiteMembers()
  }, [active, siteId, form])

  // Add team member
  const addTeamMember = () => {
    const newTeamList = [...teamList, { email: "", role: "view" as TeamRole, name: "", position: "" }]
    setTeamList(newTeamList)
    form.setValue("team_members", newTeamList)
  }

  // Remove team member
  const removeTeamMember = async (index: number) => {
    const memberToRemove = teamList[index]
    
    // If this is an actual site member with an ID, remove it from the database
    if (siteId && memberToRemove.id) {
      try {
        await siteMembersService.removeMember(memberToRemove.id)
        toast.success(`${memberToRemove.name || memberToRemove.email} removed from team`)
      } catch (error) {
        console.error("Error removing team member:", error)
        toast.error("Failed to remove team member")
        return
      }
    }
    
    const newTeamList = teamList.filter((_, i) => i !== index)
    setTeamList(newTeamList)
    form.setValue("team_members", newTeamList)
  }

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
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              const newTeamList = [...teamList]
                              newTeamList[index] = {
                                ...newTeamList[index],
                                name: e.target.value
                              }
                              setTeamList(newTeamList)
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
                            onChange={(e) => {
                              field.onChange(e)
                              const newTeamList = [...teamList]
                              newTeamList[index] = {
                                ...newTeamList[index],
                                email: e.target.value
                              }
                              setTeamList(newTeamList)
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
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e)
                              const newTeamList = [...teamList]
                              newTeamList[index] = {
                                ...newTeamList[index],
                                position: e.target.value
                              }
                              setTeamList(newTeamList)
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
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-sm font-medium">Role</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            const newTeamList = [...teamList]
                            newTeamList[index] = {
                              ...newTeamList[index],
                              role: value as TeamRole
                            }
                            setTeamList(newTeamList)
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12">
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => removeTeamMember(index)}
                    className="h-12 w-12 mt-2"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
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
    </Card>
  )
} 