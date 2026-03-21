"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { cn } from "@/lib/utils"
import { 
  Eye, 
  Settings,
  LogOut,
  Check,
  X
} from "@/app/components/ui/icons"
import { PasswordFormValues } from "./authentication-types"

interface ChangePasswordCardProps {
  passwordForm: UseFormReturn<PasswordFormValues>;
  hasPasswordChanges: boolean;
  onPasswordUpdated: (updated: boolean) => void;
  setHasPasswordChanges: (changes: boolean) => void;
  defaultPasswordValues: PasswordFormValues;
}

export function ChangePasswordCard({ 
  passwordForm, 
  hasPasswordChanges, 
  onPasswordUpdated,
  setHasPasswordChanges,
  defaultPasswordValues
}: ChangePasswordCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle password update
  const handleUpdatePassword = async (data: PasswordFormValues) => {
    try {
      setIsSaving(true);
      onPasswordUpdated(false);
      const supabase = createClient();
      
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      });
      
      if (error) {
        throw error;
      }
      
      // Show success toast and reset form
      toast.success("Password updated successfully");
      onPasswordUpdated(true);
      passwordForm.reset(defaultPasswordValues);
      
      // Reset password visibility states
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      
      // Reset password changes flag to disable save button
      setHasPasswordChanges(false);
      
      // Automatically clear success message after some time
      setTimeout(() => {
        onPasswordUpdated(false);
      }, 5000);
      
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error instanceof Error ? error.message : "Error updating password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card id="change-password" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Change Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-8">
        <FormField
          control={passwordForm.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Current Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                    placeholder="Enter your current password" 
                    type={showCurrentPassword ? "text" : "password"}
                    {...field} 
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </FormControl>
              <FormMessage className="text-xs mt-2" />
            </FormItem>
          )}
        />

        <FormField
          control={passwordForm.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                    placeholder="Enter your new password"
                    type={showNewPassword ? "text" : "password"}
                    {...field} 
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </FormControl>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center text-xs space-x-1">
                  {/[A-Z]/.test(field.value || '') ? 
                    <Check className="h-3 w-3 text-green-500" /> : 
                    <X className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className={cn(
                    /[A-Z]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                  )}>Uppercase letter</span>
                </div>
                <div className="flex items-center text-xs space-x-1">
                  {/[a-z]/.test(field.value || '') ? 
                    <Check className="h-3 w-3 text-green-500" /> : 
                    <X className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className={cn(
                    /[a-z]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                  )}>Lowercase letter</span>
                </div>
                <div className="flex items-center text-xs space-x-1">
                  {/[0-9]/.test(field.value || '') ? 
                    <Check className="h-3 w-3 text-green-500" /> : 
                    <X className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className={cn(
                    /[0-9]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                  )}>Number</span>
                </div>
                <div className="flex items-center text-xs space-x-1">
                  {/[^A-Za-z0-9]/.test(field.value || '') ? 
                    <Check className="h-3 w-3 text-green-500" /> : 
                    <X className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className={cn(
                    /[^A-Za-z0-9]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                  )}>Special character</span>
                </div>
                <div className="flex items-center text-xs space-x-1">
                  {(field.value?.length || 0) >= 8 ? 
                    <Check className="h-3 w-3 text-green-500" /> : 
                    <X className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className={cn(
                    (field.value?.length || 0) >= 8 ? 'text-green-500' : 'text-muted-foreground'
                  )}>8+ characters</span>
                </div>
              </div>
              <FormMessage className="text-xs mt-2" />
            </FormItem>
          )}
        />

        <FormField
          control={passwordForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                    placeholder="Confirm your new password"
                    type={showConfirmPassword ? "text" : "password"}
                    {...field} 
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </FormControl>
              <FormMessage className="text-xs mt-2" />
            </FormItem>
          )}
        />
      </CardContent>
      <ActionFooter>
        <Button
          type="button"
          onClick={() => passwordForm.handleSubmit(handleUpdatePassword)()}
          variant="outline"
          disabled={!hasPasswordChanges || isSaving}
        >
          {isSaving ? "Saving..." : "Save Password"}
        </Button>
      </ActionFooter>
    </Card>
  )
}