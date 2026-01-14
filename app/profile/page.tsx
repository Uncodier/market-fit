"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import { 
  User, 
  FileText, 
  Globe, 
  Trash2, 
  UploadCloud,
  Settings,
  Home
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { useProfile } from "@/app/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "@/app/context/ThemeContext"
import { ProfileSkeleton } from "./components/ProfileSkeleton"
import { EmailSecurityCard } from "./components/EmailSecurityCard"

type UserRole = "Product Manager" | "Designer" | "Developer" | "Marketing" | "Sales" | "CEO" | "Other"

export default function ProfilePage() {
  const { 
    profile, 
    isLoading, 
    isUpdating, 
    updateProfile, 
    updateNotifications,
    requestEmailChange,
    emailChangeStatus,
    name,
    email,
    bio,
    role,
    language,
    timezone,
    avatarUrl,
    notifications
  } = useProfile()
  
  const { isDarkMode } = useTheme()
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    role: "Product Manager" as UserRole,
    language: "es",
    timezone: "America/Mexico_City"
  })
  
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true
  })
  
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Actualizar formulario cuando se carga el perfil
  useEffect(() => {
    if (profile) {
      setFormData({
        name: name || "",
        bio: bio || "",
        role: (role as UserRole) || "Product Manager",
        language: language || "es",
        timezone: timezone || "America/Mexico_City"
      })
      setNotificationSettings(notifications || { email: true, push: true })
      setImageUrl(avatarUrl || null)
    }
  }, [profile, name, bio, role, language, timezone, avatarUrl, notifications])

  // Manejador de cambios en el formulario
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Manejador de cambios en notificaciones
  const handleNotificationChange = (field: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Manejador de imágenes
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return
      
      if (file.size > 3 * 1024 * 1024) {
        toast.error("Image is too large. Maximum 3MB")
        return
      }
      
      try {
        const supabase = createClient()
        toast.loading("Uploading image...")
        
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        
        const options = [
          { bucket: 'avatars', path: `avatars/${fileName}` },
          { bucket: 'assets', path: `avatars/${fileName}` },
          { bucket: 'avatars', path: fileName },
          { bucket: 'assets', path: fileName }
        ];
        
        let uploadResult = null;
        let bucketName = '';
        let filePath = '';
        
        for (const option of options) {
          try {
            const result = await supabase
              .storage
              .from(option.bucket)
              .upload(option.path, file, {
                upsert: true,
                contentType: file.type
              });
              
            if (!result.error) {
              uploadResult = result;
              bucketName = option.bucket;
              filePath = option.path;
              break;
            }
          } catch (err) {
            console.error(`Error with ${option.bucket}/${option.path}:`, err);
          }
        }
        
        if (!uploadResult) {
          throw new Error("Could not upload image");
        }
        
        const { data: urlData } = supabase
          .storage
          .from(bucketName)
          .getPublicUrl(filePath);
        
        if (!urlData?.publicUrl) {
          throw new Error("Could not get image URL");
        }
        
        setImageUrl(urlData.publicUrl);
        await updateProfile({ avatar_url: urlData.publicUrl }, true);
        
        toast.dismiss();
        toast.success("Image uploaded successfully");
      } catch (error) {
        toast.dismiss()
        toast.error(error instanceof Error ? error.message : "Error uploading image")
        console.error("Error uploading image:", error)
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxSize: 3 * 1024 * 1024,
    multiple: false
  })

  const handleSavePersonalInfo = async () => {
    try {
      const profileData = {
        name: formData.name,
        bio: formData.bio,
        role: formData.role,
        avatar_url: imageUrl || undefined
      }
      
      const success = await updateProfile(profileData, true)
      if (success) {
        toast.success("Personal information updated successfully")
      } else {
        toast.error("Failed to update personal information")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error updating personal information")
    }
  }

  const handleSavePreferences = async () => {
    try {
      const profileData = {
        language: formData.language,
        timezone: formData.timezone
      }
      
      const success = await updateProfile(profileData, true)
      if (success) {
        toast.success("Preferences updated successfully")
      } else {
        toast.error("Failed to update preferences")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error updating preferences")
    }
  }

  const handleSaveNotifications = async () => {
    try {
      const success = await updateNotifications(notificationSettings, true)
      if (success) {
        toast.success("Notification settings updated successfully")
      } else {
        toast.error("Failed to update notification settings")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error updating notification settings")
    }
  }

  const handleRemoveImage = async () => {
    setImageUrl(null)
    await updateProfile({ avatar_url: undefined }, true)
    toast.success("Profile picture removed")
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
        </div>
      </StickyHeader>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <div className="space-y-12">
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                <div className="min-w-[240px] flex-shrink-0">
                  <label className="block text-sm font-medium mb-2">Profile Picture</label>
                  <div className="w-[240px] h-[240px] relative">
                    {imageUrl ? (
                      <div className="w-full h-full relative group">
                        <Image
                          src={imageUrl}
                          alt="Profile picture"
                          fill
                          className="object-cover rounded-full"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={cn(
                          "w-full h-full rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-border/60 transition-colors",
                          isDarkMode ? "bg-muted/40" : "bg-muted/50"
                        )}
                      >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center justify-center">
                          <UploadCloud className="h-8 w-8 text-muted-foreground flex-shrink-0 mb-2" />
                          <div className="text-sm text-center flex flex-col items-center">
                            <p className="font-medium">Click to upload</p>
                            <p className="text-muted-foreground">or drag and drop</p>
                            <p className="text-xs text-muted-foreground/80 mt-1">Max. 3MB</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-12 h-12 text-base transition-colors duration-200" 
                        placeholder="Your name" 
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <div className="relative">
                      <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Select
                        value={formData.role}
                        onValueChange={(value) => handleInputChange('role', value)}
                      >
                        <SelectTrigger className="w-full pl-11 h-11 text-base transition-colors duration-200">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Product Manager">Product Manager</SelectItem>
                          <SelectItem value="Designer">Designer</SelectItem>
                          <SelectItem value="Developer">Developer</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="CEO">CEO</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Bio</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea 
                    className="pl-12 resize-none min-h-[120px] text-base transition-colors duration-200"
                    placeholder="Tell us about yourself..."
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSavePersonalInfo}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Personal Information"}
              </Button>
            </ActionFooter>
          </Card>

          <EmailSecurityCard
            email={email}
            emailChangeStatus={emailChangeStatus}
            onRequestEmailChange={requestEmailChange}
            isUpdating={isUpdating}
          />

          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div>
                <label className="block text-sm font-medium mb-2">Language</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={formData.language}
                    onValueChange={(value) => handleInputChange('language', value)}
                  >
                    <SelectTrigger className="w-full pl-12 h-12 text-base transition-colors duration-200">
                      <SelectValue placeholder="Select your language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Timezone</label>
                <div className="relative">
                  <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => handleInputChange('timezone', value)}
                  >
                    <SelectTrigger className="w-full pl-12 h-12 text-base transition-colors duration-200">
                      <SelectValue placeholder="Select your timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Mexico_City">Mexico City (GMT-6)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Los Angeles (GMT-8)</SelectItem>
                      <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                      <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (GMT+9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSavePreferences}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Preferences"}
              </Button>
            </ActionFooter>
          </Card>

          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                <div className="space-y-0.5">
                  <label className="text-base font-medium">
                    Email Notifications
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates in your email
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.email}
                  onCheckedChange={(value) => handleNotificationChange('email', value)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                <div className="space-y-0.5">
                  <label className="text-base font-medium">
                    Push Notifications
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Receive real-time notifications
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.push}
                  onCheckedChange={(value) => handleNotificationChange('push', value)}
                />
              </div>
            </CardContent>
            <ActionFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveNotifications}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Notifications"}
              </Button>
            </ActionFooter>
          </Card>
        </div>
      </div>
    </div>
  )
} 