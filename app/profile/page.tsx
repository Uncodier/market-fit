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

type UserRole = "Product Manager" | "Designer" | "Developer" | "Marketing" | "Sales" | "Other"

const profileFormSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Debe ser un email válido"),
  picture: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(["Product Manager", "Designer", "Developer", "Marketing", "Sales", "Other"] as const),
  language: z.string(),
  timezone: z.string(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean()
  })
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// Valores predeterminados para evitar undefined
const defaultValues: ProfileFormValues = {
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
  const [isSaving, setIsSaving] = useState(false)

  // Adaptamos el usuario para el formulario
  const adaptUserToForm = (user: any): ProfileFormValues => {
    return {
      name: user?.name || "",
      email: user?.email || "",
      picture: user?.picture || "",
      bio: user?.bio || "",
      role: user?.role || "Product Manager",
      language: user?.language || "es",
      timezone: user?.timezone || "America/Mexico_City",
      notifications: {
        email: user?.notifications?.email ?? true,
        push: user?.notifications?.push ?? true
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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          form.setValue("picture", reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  })

  const handleSave = async (data: ProfileFormValues) => {
    try {
      setIsSaving(true)
      // Aquí iría la lógica para actualizar el perfil en el backend
      // Por ejemplo, llamar a una API o acción del servidor
      
      // Simulamos una llamada a API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log("Datos a guardar:", data)
      
      toast.success("Profile updated successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error updating profile")
    } finally {
      setIsSaving(false)
    }
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
              <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                    <div className="min-w-[240px] flex-shrink-0">
                      <FormField
                        control={form.control}
                        name="picture"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="mb-2">Profile Picture</FormLabel>
                            <FormControl>
                              <div className="w-[240px] h-[240px] relative">
                                {field.value ? (
                                  <div className="w-full h-full relative group">
                                    <Image
                                      src={field.value}
                                      alt="Profile picture"
                                      fill
                                      className="object-cover rounded-full"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => field.onChange("")}
                                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
                                    >
                                      <Trash2 className="h-4 w-4 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    {...getRootProps()}
                                    className="w-full h-full rounded-full border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-100 transition-colors"
                                  >
                                    <input {...getInputProps()} />
                                    <UploadCloud className="h-8 w-8 text-gray-400" />
                                    <div className="text-sm text-center">
                                      <p className="font-medium text-gray-600">Click to upload</p>
                                      <p className="text-gray-500">or drag and drop</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex-1 space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input 
                                  className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
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
                            <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input 
                                  className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
                                  placeholder="you@example.com" 
                                  {...field} 
                                  disabled 
                                />
                              </div>
                            </FormControl>
                            <FormDescription className="text-xs mt-2 text-gray-500">
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
                            <FormLabel className="text-sm font-medium text-gray-700">Role</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                                <Select
                                  {...field}
                                >
                                  <SelectTrigger className="w-full pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200">
                                    <SelectValue placeholder="Select your role" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white">
                                    <SelectItem value="Product Manager">Product Manager</SelectItem>
                                    <SelectItem value="Designer">Designer</SelectItem>
                                    <SelectItem value="Developer">Developer</SelectItem>
                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                    <SelectItem value="Sales">Sales</SelectItem>
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
                        <FormLabel className="text-sm font-medium text-gray-700">Bio</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-3 h-4 w-4 text-gray-400" />
                            <Textarea 
                              className="pl-12 resize-none min-h-[120px] text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200"
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

              <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Language</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Select
                              {...field}
                            >
                              <SelectTrigger className="w-full pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200">
                                <SelectValue placeholder="Select your language" />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
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
                        <FormLabel className="text-sm font-medium text-gray-700">Timezone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Select
                              {...field}
                            >
                              <SelectTrigger className="w-full pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200">
                                <SelectValue placeholder="Select your timezone" />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
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

              <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="notifications.email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 hover:border-gray-300 transition-colors duration-200 p-4">
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 hover:border-gray-300 transition-colors duration-200 p-4">
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