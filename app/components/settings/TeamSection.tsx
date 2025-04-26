"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, User, Mail, FileText } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface TeamSectionProps {
  active: boolean
}

const TEAM_ROLES = [
  { value: "view", label: "Viewer (View only)" },
  { value: "create", label: "Editor (Create and edit)" },
  { value: "delete", label: "Manager (Full access)" },
  { value: "admin", label: "Admin (Owner privileges)" }
]

type TeamRole = "view" | "create" | "delete" | "admin";

export function TeamSection({ active }: TeamSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [teamList, setTeamList] = useState<{name?: string, email: string, role: TeamRole, position?: string}[]>(
    form.getValues("team_members") || []
  )

  // Add team member
  const addTeamMember = () => {
    const newTeamList = [...teamList, { email: "", role: "view" as TeamRole, name: "", position: "" }]
    setTeamList(newTeamList)
    form.setValue("team_members", newTeamList)
  }

  // Remove team member
  const removeTeamMember = (index: number) => {
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
        {teamList.map((member, index) => (
          <div key={index} className="space-y-4 p-4 border border-border rounded-lg">
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
        ))}
        <Button
          variant="outline"
          className="mt-2 w-full h-12"
          type="button"
          onClick={addTeamMember}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Team Member
        </Button>
        <div className="text-sm text-muted-foreground mt-4">
          <p>Team members will receive an email invitation to join your site.</p>
        </div>
      </CardContent>
    </Card>
  )
} 