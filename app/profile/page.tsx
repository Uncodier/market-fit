"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import { 
  User, 
  FileText, 
  Globe, 
  Bell,
  Trash2, 
  UploadCloud,
  Settings,
  MessageSquare,
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
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "@/app/context/ThemeContext"

// Define Supabase bucket type
interface StorageBucket {
  id: string;
  name: string;
  owner: string;
  public: boolean;
  created_at: string;
  updated_at: string;
}

type UserRole = "Product Manager" | "Designer" | "Developer" | "Marketing" | "Sales" | "CEO" | "Other"

const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Must be a valid email"),
  picture: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(["Product Manager", "Designer", "Developer", "Marketing", "Sales", "CEO", "Other"] as const).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true)
  }).optional().default({
    email: true,
    push: true
  })
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// Valores predeterminados para evitar undefined
const defaultValues: Partial<ProfileFormValues> = {
  name: "",
  email: "",
  picture: "",
  bio: "",
  role: "Product Manager",
  language: "es",
  timezone: "America/Mexico_City",
  notifications: {
    email: true,
    push: true
  }
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { isDarkMode } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  
  // Adaptamos el usuario para el formulario
  const adaptUserToForm = (user: any): ProfileFormValues => {
    const userData = user.user_metadata || {}
    
    // Si hay una URL de imagen válida, usarla
    if (userData.picture && typeof userData.picture === 'string') {
      setImageUrl(userData.picture)
    }
    
    return {
      name: userData.name || user?.name || "",
      email: user?.email || "",
      picture: "", // No pasamos la imagen al formulario, la manejamos por separado
      bio: userData.bio || "",
      role: (userData.role as UserRole) || "Product Manager",
      language: userData.language || "es",
      timezone: userData.timezone || "America/Mexico_City",
      notifications: {
        email: userData.notifications?.email ?? true,
        push: userData.notifications?.push ?? true
      }
    }
  }
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  })

  // Para asegurar que el formulario se actualice cuando el usuario cambie
  useEffect(() => {
    if (user) {
      form.reset(adaptUserToForm(user))
    }
  }, [user, form])

  // Manejador de imágenes simplificado y seguro
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return
      
      // Verificar tamaño
      if (file.size > 3 * 1024 * 1024) {
        toast.error("Image is too large. Maximum 3MB")
        return
      }
      
      try {
        // Subir directamente a Supabase sin almacenar en form
        const supabase = createClient()
        
        // Mostrar loader
        toast.loading("Uploading image...")
        
        // Generar nombre único para evitar colisiones
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        
        // Try multiple bucket and path combinations to find one that works with RLS policies
        let uploadResult = null;
        let bucketName = '';
        let filePath = '';
        
        // Array of possible bucket and path combinations to try
        const options = [
          { bucket: 'avatars', path: `${user?.id || 'anonymous'}/${fileName}` },
          { bucket: 'avatars', path: `public/${fileName}` },
          { bucket: 'avatars', path: fileName },
          { bucket: 'assets', path: `${user?.id || 'anonymous'}/${fileName}` },
          { bucket: 'assets', path: `public/${fileName}` },
          { bucket: 'assets', path: fileName }
        ];
        
        // Try each option until one works
        for (const option of options) {
          try {
            console.log(`Trying to upload to bucket: ${option.bucket}, path: ${option.path}`);
            
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
              console.log(`Success! Uploaded to bucket: ${bucketName}, path: ${filePath}`);
              break;
            } else {
              console.log(`Failed with: ${result.error.message}`);
            }
          } catch (err) {
            console.error(`Error with ${option.bucket}/${option.path}:`, err);
          }
        }
        
        // If no options worked, throw an error
        if (!uploadResult) {
          throw new Error("Could not upload image: Permission denied in all storage locations");
        }
        
        // Get the public URL for the uploaded file
        const { data: urlData } = supabase
          .storage
          .from(bucketName)
          .getPublicUrl(filePath);
        
        console.log("Image uploaded to URL:", urlData?.publicUrl);
        
        if (!urlData?.publicUrl) {
          throw new Error("Could not get image URL");
        }
        
        // Guardar URL en estado para mostrar
        setImageUrl(urlData.publicUrl);
        
        // Cerrar loader
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

  const handleSave = async (data: ProfileFormValues) => {
    try {
      setIsSaving(true)
      
      // Garantizar que todos los campos se guarden
      const completeData = {
        ...defaultValues,
        ...data,
        notifications: {
          email: data.notifications?.email ?? true,
          push: data.notifications?.push ?? true
        }
      }
      
      // Actualizar el perfil en Supabase
      if (user) {
        const supabase = createClient()
        
        // Actualizar los metadatos del usuario - usando la URL segura
        const { error } = await supabase.auth.updateUser({
          data: {
            name: completeData.name,
            bio: completeData.bio,
            role: completeData.role,
            picture: imageUrl, // Usamos URL segura, nunca base64
            avatar_url: imageUrl, // También guardamos como avatar_url para el profile del email
            language: completeData.language,
            timezone: completeData.timezone,
            notifications: completeData.notifications,
            updated_at: new Date().toISOString()
          }
        })
        
        if (error) {
          console.error("Error updating profile:", error)
          throw new Error(`Error updating profile: ${error.message}`)
        }
        
        toast.success("Profile updated successfully")
      } else {
        throw new Error("User not found")
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Error updating profile")
    } finally {
      setIsSaving(false)
    }
  }

  // Función para eliminar la imagen
  const handleRemoveImage = () => {
    setImageUrl(null)
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <div className="flex-1" />
          <Button 
            disabled={isSaving}
            type="submit"
            form="profile-form"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </StickyHeader>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            id="profile-form"
            className="space-y-12"
          >
            <div className="space-y-12">
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                    <div className="min-w-[240px] flex-shrink-0">
                      <FormItem>
                        <FormLabel className="mb-2">Profile Picture</FormLabel>
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
                      </FormItem>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  className="pl-12 h-12 text-base transition-colors duration-200" 
                                  placeholder="Your name" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs mt-2" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  className="pl-12 h-12 text-base transition-colors duration-200" 
                                  placeholder="you@example.com" 
                                  {...field} 
                                  disabled 
                                />
                              </div>
                            </FormControl>
                            <FormDescription className="text-xs mt-2 text-muted-foreground">
                              Email cannot be changed.
                            </FormDescription>
                            <FormMessage className="text-xs mt-2" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Role</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="w-full pl-12 h-12 text-base transition-colors duration-200">
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
                            </FormControl>
                            <FormMessage className="text-xs mt-2" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Bio</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea 
                              className="pl-12 resize-none min-h-[120px] text-base transition-colors duration-200"
                              placeholder="Tell us about yourself..."
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Language</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
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
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Timezone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
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
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="notifications.email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Email Notifications
                          </FormLabel>
                          <FormDescription>
                            Receive updates in your email
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notifications.push"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Push Notifications
                          </FormLabel>
                          <FormDescription>
                            Receive real-time notifications
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
} 