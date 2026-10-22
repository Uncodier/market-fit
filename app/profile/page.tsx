"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import { 
  User, 
  FileText, 
  Trash2, 
  UploadCloud,
  Settings,
  Phone
} from "@/app/components/ui/icons"
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
import { CalendarPreferences } from "./components/CalendarPreferences"
import { SiteNotificationsPreferences } from "./components/SiteNotificationsPreferences"
import { ProfilePreferences } from "./components/ProfilePreferences"
import { CalendarSettings } from "@/app/services/profile.service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

type UserRole = "Product Manager" | "Designer" | "Developer" | "Marketing" | "Sales" | "CEO" | "Other"

export default function ProfilePage() {
  const { t } = useLocalization()
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title: t('layout.nav.profile.title') } }))
  }, [t])
  const { 
    profile, 
    isLoading, 
    isUpdating, 
    updateProfile, 
    requestEmailChange,
    emailChangeStatus,
    email,
    updateSettings
  } = useProfile()
  
  const { isDarkMode } = useTheme()
  
  // Personal information form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    bio: "",
    role: "Product Manager" as UserRole
  })
  
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Populate personal information when the profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        role: (profile.role as UserRole) || "Product Manager"
      })
      setImageUrl(profile.avatar_url || null)
    }
  }, [profile])

  // Handle personal information changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle profile picture uploads
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return
      
      if (file.size > 3 * 1024 * 1024) {
        toast.error(t("account.profile.imageTooLarge"))
        return
      }
      
      try {
        const supabase = createClient()
        toast.loading(t("account.profile.uploading"))
        
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
          throw new Error(t("account.profile.uploadFailed"));
        }
        
        const { data: urlData } = supabase
          .storage
          .from(bucketName)
          .getPublicUrl(filePath);
        
        if (!urlData?.publicUrl) {
          throw new Error(t("account.profile.imageUrlFailed"));
        }
        
        setImageUrl(urlData.publicUrl);
        await updateProfile({ avatar_url: urlData.publicUrl }, true);
        
        toast.dismiss();
        toast.success(t("account.profile.imageUploaded"));
      } catch (error) {
        toast.dismiss()
        toast.error(error instanceof Error ? error.message : t("account.profile.uploadError"))
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
    if (!formData.phone || formData.phone.length < 8) {
      toast.error(t("account.profile.phoneInvalid"))
      return
    }

    try {
      const profileData = {
        name: formData.name,
        phone: formData.phone,
        bio: formData.bio,
        role: formData.role,
        avatar_url: imageUrl || undefined
      }
      
      const result = await updateProfile(profileData, true)
      
      if (result === true) {
        toast.success(t("account.profile.personalSaved"))
        setFormData(prev => ({ ...prev, phone: profileData.phone }))
      } else {
        toast.error(typeof result === 'string' ? t("account.profile.failureDetail", { error: result }) : t("account.profile.personalFailed"))
      }
    } catch (error) {
      console.error("Error in handleSavePersonalInfo:", error)
      toast.error(t("account.profile.personalError"))
    }
  }

  const handleSaveCalendarSettings = async (calendarSettings: CalendarSettings) => {
    try {
      const success = await updateSettings({
        ...profile?.settings,
        calendar: calendarSettings
      }, true)
      if (success) {
        toast.success(t("account.profile.calendarSaved"))
      } else {
        toast.error(t("account.profile.calendarFailed"))
      }
    } catch (error) {
      console.error(error)
      toast.error(t("account.profile.calendarError"))
    }
  }

  const handleRemoveImage = async () => {
    setImageUrl(null)
    await updateProfile({ avatar_url: undefined }, true)
    toast.success(t("account.profile.imageRemoved"))
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="flex-1">
      <Tabs defaultValue="profile" className="w-full">
        <StickyHeader>
          <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
            <TabsTrigger value="profile" className="text-xs rounded-full px-4">{t("layout.nav.profile.title")}</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs rounded-full px-4">{t("account.profile.notifications")}</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs rounded-full px-4">{t("calendar")}</TabsTrigger>
          </TabsList>
        </StickyHeader>
        
        <div className="px-4 md:px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <TabsContent value="profile" className="space-y-12 mt-0 border-0 p-0 focus-visible:ring-0">
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>{t("account.profile.personalInfo")}</SectionCardTitle>
              </SectionCardHeader>
              <SectionCardContent className="space-y-8">
                <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                  <div className="min-w-[240px] flex-shrink-0">
                    <label className="block text-sm font-medium mb-2">{t("account.profile.profilePicture")}</label>
                    <div className="w-[240px] h-[240px] relative">
                      {imageUrl ? (
                        <div className="w-full h-full relative group">
                          <Image
                            src={imageUrl}
                            alt={t("account.profile.pictureAlt")}
                            fill
                            className="object-cover rounded-full"
                          />
                          <button
                            type="button"
                            aria-label={t("account.profile.removePicture")}
                            onClick={handleRemoveImage}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div
                          {...getRootProps({ "aria-label": t("account.profile.uploadPicture") })}
                          className={cn(
                            "w-full h-full rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-border/60 transition-colors",
                            isDarkMode ? "bg-muted/40" : "bg-muted/50"
                          )}
                        >
                          <input {...getInputProps({ "aria-label": t("account.profile.uploadPicture") })} />
                          <div className="flex flex-col items-center justify-center">
                            <UploadCloud className="h-8 w-8 text-muted-foreground flex-shrink-0 mb-2" />
                            <div className="text-sm text-center flex flex-col items-center">
                              <p className="font-medium">{t("account.profile.upload")}</p>
                              <p className="text-muted-foreground">{t("account.profile.drop")}</p>
                              <p className="text-xs text-muted-foreground/80 mt-1">{t("account.profile.maxSize")}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t("name")}</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base transition-colors duration-200" 
                          placeholder={t("account.profile.namePlaceholder")}
                          aria-label={t("name")}
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t("phone")}</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base transition-colors duration-200" 
                          placeholder={t("account.profile.phonePlaceholder")}
                          type="tel"
                          aria-label={t("phone")}
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t("role")}</label>
                      <div className="relative">
                        <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Select
                          value={formData.role}
                          onValueChange={(value) => handleInputChange('role', value)}
                        >
                          <SelectTrigger aria-label={t("role")} className="w-full pl-11 h-11 text-base transition-colors duration-200">
                            <SelectValue placeholder={t("account.profile.rolePlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Product Manager">{t("account.profile.productManager")}</SelectItem>
                            <SelectItem value="Designer">{t("account.profile.designer")}</SelectItem>
                            <SelectItem value="Developer">{t("account.profile.developer")}</SelectItem>
                            <SelectItem value="Marketing">{t("account.profile.marketing")}</SelectItem>
                            <SelectItem value="Sales">{t("account.profile.sales")}</SelectItem>
                            <SelectItem value="CEO">{t("account.profile.ceo")}</SelectItem>
                            <SelectItem value="Other">{t("shop.other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">{t("bio")}</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea 
                      className="pl-12 resize-none min-h-[72px] text-base transition-colors duration-200"
                      placeholder={t("account.profile.bioPlaceholder")}
                      aria-label={t("bio")}
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                    />
                  </div>
                </div>
              </SectionCardContent>
              <ActionFooter>
                <Button variant="outline"
                  type="button"
                  onClick={handleSavePersonalInfo}
                  disabled={isUpdating} size="sm">
                  {isUpdating ? t("common.saving") : t("account.profile.savePersonal")}
                </Button>
              </ActionFooter>
            </SectionCard>

            <EmailSecurityCard
              email={email}
              emailChangeStatus={emailChangeStatus}
              onRequestEmailChange={requestEmailChange}
              isUpdating={isUpdating}
            />

            <ProfilePreferences
              profile={profile}
              updateProfile={updateProfile}
              isUpdating={isUpdating}
            />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 border-0 p-0 focus-visible:ring-0">
            <SiteNotificationsPreferences />
          </TabsContent>

          <TabsContent value="calendar" className="mt-0 border-0 p-0 focus-visible:ring-0">
            <CalendarPreferences
              settings={profile?.settings?.calendar}
              onSave={handleSaveCalendarSettings}
              isUpdating={isUpdating}
              userEmail={profile?.email}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
