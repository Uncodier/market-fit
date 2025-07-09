"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { ColorInput } from "../ui/color-input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select"
import { Badge } from "../ui/badge"
import { useState } from "react"
import { 
  PlusCircle, 
  Palette, 
  Type, 
  Heart, 
  Target, 
  Lightbulb,
  MessageSquare,
  CheckCircle,
  XCircle
} from "../ui/icons"

interface BrandingSectionProps {
  active: boolean
}

const BRAND_ARCHETYPES = [
  { value: "innocent", label: "Innocent", description: "Optimistic, honest, pure" },
  { value: "sage", label: "Sage", description: "Wise, intelligent, knowledgeable" },
  { value: "explorer", label: "Explorer", description: "Adventurous, pioneering, free" },
  { value: "outlaw", label: "Outlaw", description: "Rebellious, revolutionary, disruptive" },
  { value: "magician", label: "Magician", description: "Visionary, innovative, transformative" },
  { value: "hero", label: "Hero", description: "Courageous, determined, honorable" },
  { value: "lover", label: "Lover", description: "Passionate, committed, intimate" },
  { value: "jester", label: "Jester", description: "Playful, humorous, light-hearted" },
  { value: "everyman", label: "Everyman", description: "Relatable, down-to-earth, genuine" },
  { value: "caregiver", label: "Caregiver", description: "Caring, nurturing, selfless" },
  { value: "ruler", label: "Ruler", description: "Authoritative, responsible, leader" },
  { value: "creator", label: "Creator", description: "Creative, imaginative, artistic" }
]

export function BrandingSection({ active }: BrandingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [newPersonalityTrait, setNewPersonalityTrait] = useState("")
  const [newForbiddenWord, setNewForbiddenWord] = useState("")
  const [newPreferredPhrase, setNewPreferredPhrase] = useState("")
  const [newEmotion, setNewEmotion] = useState("")
  const [newDoItem, setNewDoItem] = useState("")
  const [newDontItem, setNewDontItem] = useState("")
  if (!active) return null

  // Helper functions for managing branding arrays
  const addToBrandingArray = (fieldName: string, value: string) => {
    const currentArray = form.getValues(fieldName as any) as string[] || []
    form.setValue(fieldName as any, [...currentArray, value])
  }

  const removeFromBrandingArray = (fieldName: string, index: number) => {
    const currentArray = form.getValues(fieldName as any) as string[] || []
    form.setValue(fieldName as any, currentArray.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-8">
      {/* Brand Pyramid */}
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Brand Pyramid
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Traditional brand pyramid structure - Define your brand from core to promise
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {/* Visual Brand Pyramid */}
          <div className="relative rounded-xl bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 p-8 border border-purple-100 dark:border-purple-800">
            {/* Decorative background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-purple-500/3 to-pink-500/3 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 rounded-xl"></div>
            
            <div className="relative space-y-6">
              {/* Level 1: Brand Essence (Top) */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/90 dark:bg-gray-900/80 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_essence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                            Brand Essence
                            <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">Core</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            The core essence of your brand - Who are you?
                          </FormDescription>
                          <div className="flex justify-center">
                            <div className="w-full max-w-md">
                              <FormControl>
                                <Textarea 
                                  className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                                  placeholder="We are..."
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Level 2: Brand Personality */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/85 dark:bg-gray-900/75 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_personality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                            Brand Personality
                            <div className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Identity</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            If your brand were a person, what would they be like?
                          </FormDescription>
                          <div className="flex justify-center">
                            <div className="w-full max-w-lg">
                              <FormControl>
                                <Textarea 
                                  className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                                  placeholder="We are confident, innovative, approachable..."
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Level 3: Brand Benefits */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/80 dark:bg-gray-900/70 rounded-xl p-6 border border-pink-200/50 dark:border-pink-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_benefits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"></div>
                            Brand Benefits
                            <div className="text-xs bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 px-2 py-1 rounded-full">Value</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            What emotional and functional benefits do you provide?
                          </FormDescription>
                          <div className="flex justify-center">
                            <div className="w-full max-w-xl">
                              <FormControl>
                                <Textarea 
                                  className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                                  placeholder="Peace of mind, increased efficiency, better results..."
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Level 4: Brand Attributes */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/75 dark:bg-gray-900/65 rounded-xl p-6 border border-rose-200/50 dark:border-rose-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_attributes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full"></div>
                            Brand Attributes
                            <div className="text-xs bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-full">Features</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            What are the key features and characteristics of your offering?
                          </FormDescription>
                          <div className="flex justify-center">
                            <div className="w-full max-w-2xl">
                              <FormControl>
                                <Textarea 
                                  className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                                  placeholder="24/7 support, advanced analytics, user-friendly interface..."
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Level 5: Brand Values */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/70 dark:bg-gray-900/60 rounded-xl p-6 border border-orange-200/50 dark:border-orange-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_values"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full"></div>
                            Brand Values
                            <div className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full">Principles</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            What core values drive your brand?
                          </FormDescription>
                          <div className="flex justify-center">
                            <div className="w-full max-w-2xl">
                              <FormControl>
                                <Textarea 
                                  className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                                  placeholder="Innovation, transparency, customer-centricity..."
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Level 6: Brand Promise (Bottom) */}
              <div className="flex items-center justify-center">
                <div className="w-full">
                  <div className="bg-white/65 dark:bg-gray-900/55 rounded-xl p-6 border border-yellow-200/50 dark:border-yellow-800/50">
                    <FormField
                      control={form.control}
                      name="branding.brand_promise"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"></div>
                            Brand Promise
                            <div className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">Commitment</div>
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            What do you promise to deliver to your customers?
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              className="resize-none min-h-[60px] text-base bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/20 dark:focus:ring-purple-500/20"
                              placeholder="We promise to..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Archetype Selection */}
          <FormField
            control={form.control}
            name="branding.brand_archetype"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Brand Archetype</FormLabel>
                <FormDescription>
                  Choose the personality archetype that best represents your brand
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select brand archetype" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAND_ARCHETYPES.map((archetype) => (
                        <SelectItem key={archetype.value} value={archetype.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{archetype.label}</span>
                            <span className="text-xs text-muted-foreground">{archetype.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Palette
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define your brand's color system
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="branding.primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Primary Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#000000"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="branding.secondary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Secondary Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#666666"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="branding.accent_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Accent Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#e0ff17"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.success_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Success Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#22c55e"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.warning_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Warning Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#f59e0b"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.error_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Error Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#ef4444"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.background_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Background Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#ffffff"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.surface_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Surface Color</FormLabel>
                  <FormControl>
                    <ColorInput
                      value={field.value || "#f8fafc"}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define your brand's typography system
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="branding.primary_font"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Primary Font</FormLabel>
                  <FormDescription>
                    Main font for headings and important text
                  </FormDescription>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Inter, Roboto, Open Sans"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branding.secondary_font"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Secondary Font</FormLabel>
                  <FormDescription>
                    Font for body text and secondary content
                  </FormDescription>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Georgia, Times, serif"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="branding.font_size_scale"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Font Size Scale</FormLabel>
                <FormDescription>
                  Overall scale for typography sizing
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value || "medium"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select font size scale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small - Compact typography</SelectItem>
                      <SelectItem value="medium">Medium - Balanced typography</SelectItem>
                      <SelectItem value="large">Large - Spacious typography</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Voice and Tone */}
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Voice and Tone
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define how your brand communicates with your audience
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.communication_style"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Communication Style</FormLabel>
                <FormDescription>
                  How should your brand communicate with customers?
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value || "friendly"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select communication style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
              </FormItem>
            )}
          />

          {/* Personality Traits */}
          <div className="space-y-3">
            <FormLabel className="text-sm font-medium text-foreground">Personality Traits</FormLabel>
            <FormDescription>
              Key personality traits that define your brand
            </FormDescription>
            <div className="space-y-2">
              {(form.watch("branding.personality_traits") || []).map((trait: string, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <Badge variant="secondary" className="flex-1 justify-start gap-2 py-2 px-3">
                    {trait}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromBrandingArray("branding.personality_traits", index)}
                    className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add personality trait..."
                value={newPersonalityTrait}
                onChange={(e) => setNewPersonalityTrait(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newPersonalityTrait.trim()) {
                      addToBrandingArray("branding.personality_traits", newPersonalityTrait.trim())
                      setNewPersonalityTrait("")
                    }
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newPersonalityTrait.trim()) {
                    addToBrandingArray("branding.personality_traits", newPersonalityTrait.trim())
                    setNewPersonalityTrait("")
                  }
                }}
                className="flex-shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Emotions to Evoke */}
          <div className="space-y-3">
            <FormLabel className="text-sm font-medium text-foreground">Emotions to Evoke</FormLabel>
            <FormDescription>
              What emotions should your brand evoke in customers?
            </FormDescription>
            <div className="space-y-2">
              {(form.watch("branding.emotions_to_evoke") || []).map((emotion: string, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <Badge variant="secondary" className="flex-1 justify-start gap-2 py-2 px-3">
                    <Heart className="h-3 w-3" />
                    {emotion}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromBrandingArray("branding.emotions_to_evoke", index)}
                    className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add emotion..."
                value={newEmotion}
                onChange={(e) => setNewEmotion(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newEmotion.trim()) {
                      addToBrandingArray("branding.emotions_to_evoke", newEmotion.trim())
                      setNewEmotion("")
                    }
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newEmotion.trim()) {
                    addToBrandingArray("branding.emotions_to_evoke", newEmotion.trim())
                    setNewEmotion("")
                  }
                }}
                className="flex-shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Guidelines */}
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Brand Guidelines
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define what your brand should and shouldn't do
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {/* Do's */}
          <div className="space-y-3">
            <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Brand Do's
            </FormLabel>
            <FormDescription>
              Things your brand should always do
            </FormDescription>
            <div className="space-y-2">
              {(form.watch("branding.do_list") || []).map((item: string, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <Badge variant="secondary" className="flex-1 justify-start gap-2 py-2 px-3 bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    {item}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromBrandingArray("branding.do_list", index)}
                    className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a do..."
                value={newDoItem}
                onChange={(e) => setNewDoItem(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newDoItem.trim()) {
                      addToBrandingArray("branding.do_list", newDoItem.trim())
                      setNewDoItem("")
                    }
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newDoItem.trim()) {
                    addToBrandingArray("branding.do_list", newDoItem.trim())
                    setNewDoItem("")
                  }
                }}
                className="flex-shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Don'ts */}
          <div className="space-y-3">
            <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Brand Don'ts
            </FormLabel>
            <FormDescription>
              Things your brand should never do
            </FormDescription>
            <div className="space-y-2">
              {(form.watch("branding.dont_list") || []).map((item: string, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <Badge variant="destructive" className="flex-1 justify-start gap-2 py-2 px-3 bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    {item}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromBrandingArray("branding.dont_list", index)}
                    className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a don't..."
                value={newDontItem}
                onChange={(e) => setNewDontItem(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (newDontItem.trim()) {
                      addToBrandingArray("branding.dont_list", newDontItem.trim())
                      setNewDontItem("")
                    }
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newDontItem.trim()) {
                    addToBrandingArray("branding.dont_list", newDontItem.trim())
                    setNewDontItem("")
                  }
                }}
                className="flex-shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Language Guidelines */}
          <div className="space-y-6 mt-8 pt-6 border-t border-border">
            {/* Preferred Phrases */}
            <div className="space-y-3">
              <FormLabel className="text-sm font-medium text-foreground">Preferred Phrases</FormLabel>
              <FormDescription>
                Phrases that align with your brand voice
              </FormDescription>
              <div className="space-y-2">
                {(form.watch("branding.preferred_phrases") || []).map((phrase: string, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <Badge variant="outline" className="flex-1 justify-start gap-2 py-2 px-3">
                      {phrase}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromBrandingArray("branding.preferred_phrases", index)}
                      className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add preferred phrase..."
                  value={newPreferredPhrase}
                  onChange={(e) => setNewPreferredPhrase(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newPreferredPhrase.trim()) {
                        addToBrandingArray("branding.preferred_phrases", newPreferredPhrase.trim())
                        setNewPreferredPhrase("")
                      }
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newPreferredPhrase.trim()) {
                      addToBrandingArray("branding.preferred_phrases", newPreferredPhrase.trim())
                      setNewPreferredPhrase("")
                    }
                  }}
                  className="flex-shrink-0"
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Forbidden Words */}
            <div className="space-y-3">
              <FormLabel className="text-sm font-medium text-foreground">Forbidden Words</FormLabel>
              <FormDescription>
                Words that should never be used in your brand communication
              </FormDescription>
              <div className="space-y-2">
                {(form.watch("branding.forbidden_words") || []).map((word: string, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <Badge variant="destructive" className="flex-1 justify-start gap-2 py-2 px-3 bg-red-50 text-red-700 border-red-200">
                      {word}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromBrandingArray("branding.forbidden_words", index)}
                      className="flex-shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add forbidden word..."
                  value={newForbiddenWord}
                  onChange={(e) => setNewForbiddenWord(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newForbiddenWord.trim()) {
                        addToBrandingArray("branding.forbidden_words", newForbiddenWord.trim())
                        setNewForbiddenWord("")
                      }
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newForbiddenWord.trim()) {
                      addToBrandingArray("branding.forbidden_words", newForbiddenWord.trim())
                      setNewForbiddenWord("")
                    }
                  }}
                  className="flex-shrink-0"
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  )
} 