"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
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
  XCircle,
  Trash2
} from "../ui/icons"

import { type SiteFormValues } from "./form-schema"

interface BrandingSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
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

export function BrandingSection({ active, onSave }: BrandingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)
  const [newPersonalityTrait, setNewPersonalityTrait] = useState("")
  const [newForbiddenWord, setNewForbiddenWord] = useState("")
  const [newPreferredPhrase, setNewPreferredPhrase] = useState("")
  const [newEmotion, setNewEmotion] = useState("")
  const [newDoItem, setNewDoItem] = useState("")
  const [newDontItem, setNewDontItem] = useState("")
  const [showPersonalityTraitInput, setShowPersonalityTraitInput] = useState(false)
  const [showEmotionInput, setShowEmotionInput] = useState(false)
  const [showDoInput, setShowDoInput] = useState(false)
  const [showDontInput, setShowDontInput] = useState(false)
  const [showPreferredPhraseInput, setShowPreferredPhraseInput] = useState(false)
  const [showForbiddenWordInput, setShowForbiddenWordInput] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving branding:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!active) return null

  // Helper functions for managing branding arrays
  const addToBrandingArray = (fieldName: string, value: string) => {
    const currentArray = form.getValues(fieldName as any) as string[] || []
    const newArray = [value, ...currentArray]
    form.setValue(fieldName as any, newArray, { shouldDirty: true, shouldValidate: true })
  }

  const removeFromBrandingArray = (fieldName: string, index: number) => {
    const currentArray = form.getValues(fieldName as any) as string[] || []
    const newArray = currentArray.filter((_, i) => i !== index)
    form.setValue(fieldName as any, newArray, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="space-y-8">
      {/* Brand Essence */}
      <Card id="brand-essence" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Essence
                <Badge variant="secondary" className="text-xs">Core</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                The core essence of your brand - Who are you?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.brand_essence"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="We are..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Personality */}
      <Card id="brand-personality" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Personality
                <Badge variant="secondary" className="text-xs">Identity</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                If your brand were a person, what would they be like?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.brand_personality"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="We are confident, innovative, approachable..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Benefits */}
      <Card id="brand-benefits" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Benefits
                <Badge variant="secondary" className="text-xs">Value</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                What emotional and functional benefits do you provide?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.brand_benefits"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="Peace of mind, increased efficiency, better results..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Attributes */}
      <Card id="brand-attributes" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Attributes
                <Badge variant="secondary" className="text-xs">Features</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                What are the key features and characteristics of your offering?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.brand_attributes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="24/7 support, advanced analytics, user-friendly interface..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Values */}
      <Card id="brand-values" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Values
                <Badge variant="secondary" className="text-xs">Principles</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                What core values drive your brand?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <FormField
            control={form.control}
            name="branding.brand_values"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="Innovation, transparency, customer-centricity..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Promise & Archetype */}
      <Card id="brand-promise" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                Brand Promise
                <Badge variant="secondary" className="text-xs">Commitment</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                What do you promise to deliver to your customers?
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-6">
          <FormField
            control={form.control}
            name="branding.brand_promise"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[100px] text-base"
                    placeholder="We promise to..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branding.brand_archetype"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Brand Archetype</FormLabel>
                <FormDescription>
                  Choose the personality archetype that best represents your brand
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="h-11">
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
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Color Palette */}
      <Card id="color-palette" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
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
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Typography */}
      <Card id="typography" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
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
                    <SelectTrigger className="h-11">
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
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Voice and Tone */}
      <Card id="voice-tone" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
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
                    <SelectTrigger className="h-11">
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
            <div className="flex items-center justify-between">
              <div>
                <FormLabel className="text-sm font-medium text-foreground">Personality Traits</FormLabel>
                <FormDescription>
                  Key personality traits that define your brand
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPersonalityTraitInput(true)}
                className="flex-shrink-0"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {showPersonalityTraitInput && (
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
                        setShowPersonalityTraitInput(false)
                      }
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewPersonalityTrait("")
                    setShowPersonalityTraitInput(false)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Emotions to Evoke */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <FormLabel className="text-sm font-medium text-foreground">Emotions to Evoke</FormLabel>
                <FormDescription>
                  What emotions should your brand evoke in customers?
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEmotionInput(true)}
                className="flex-shrink-0"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {showEmotionInput && (
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
                        setShowEmotionInput(false)
                      }
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewEmotion("")
                    setShowEmotionInput(false)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Brand Guidelines */}
      <Card id="brand-guidelines" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
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
            <div className="flex items-center justify-between">
              <div>
                <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Brand Do's
                </FormLabel>
                <FormDescription>
                  Things your brand should always do
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDoInput(true)}
                className="flex-shrink-0"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {showDoInput && (
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
                        setShowDoInput(false)
                      }
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewDoItem("")
                    setShowDoInput(false)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Don'ts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Brand Don'ts
                </FormLabel>
                <FormDescription>
                  Things your brand should never do
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDontInput(true)}
                className="flex-shrink-0"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {showDontInput && (
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
                        setShowDontInput(false)
                      }
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewDontItem("")
                    setShowDontInput(false)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Language Guidelines */}
          <div className="space-y-6 mt-8 pt-6 border-t border-border">
            {/* Preferred Phrases */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="text-sm font-medium text-foreground">Preferred Phrases</FormLabel>
                  <FormDescription>
                    Phrases that align with your brand voice
                  </FormDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreferredPhraseInput(true)}
                  className="flex-shrink-0"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              {showPreferredPhraseInput && (
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
                          setShowPreferredPhraseInput(false)
                        }
                      }
                    }}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewPreferredPhrase("")
                      setShowPreferredPhraseInput(false)
                    }}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Forbidden Words */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="text-sm font-medium text-foreground">Forbidden Words</FormLabel>
                  <FormDescription>
                    Words that should never be used in your brand communication
                  </FormDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForbiddenWordInput(true)}
                  className="flex-shrink-0"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              {showForbiddenWordInput && (
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
                          setShowForbiddenWordInput(false)
                        }
                      }
                    }}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewForbiddenWord("")
                      setShowForbiddenWordInput(false)
                    }}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>


    </div>
  )
} 