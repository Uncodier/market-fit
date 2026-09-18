"use client"

import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"
import { ChevronDown, ChevronRight, Loader } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Slider } from "@/app/components/ui/slider"
import { Textarea } from "@/app/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  ContentStyle,
  ContentStyleSetter,
} from "../content-item-types"
import { contentStyleLabels } from "../content-item-utils"

const STYLE_CONTROLS = [
  { key: "tone", label: "Tone", low: "🧐", high: "😊" },
  { key: "complexity", label: "Complexity", low: "📝", high: "📚" },
  { key: "creativity", label: "Creativity", low: "📋", high: "🎨" },
  { key: "persuasiveness", label: "Persuasiveness", low: "ℹ️", high: "🔥" },
  { key: "targetAudience", label: "Target Audience", low: "👥", high: "👤" },
  { key: "engagement", label: "Engagement", low: "👔", high: "🤩" },
  { key: "size", label: "Size", low: "📄", high: "📜" },
] as const

function AiGenerationSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 p-4">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        </div>
        {[["w-3/4", "w-1/2", "w-5/6"], ["w-2/3", "w-3/4", "w-1/2"]].map((widths, index) => (
          <div key={index} className="space-y-3">
            {widths.map((width) => <div key={width} className={`h-4 ${width} animate-pulse rounded bg-muted`} />)}
          </div>
        ))}
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="border-t bg-background p-4">
        <div className="flex h-11 w-full items-center justify-center rounded-md bg-primary/20">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

type Props = {
  isGenerating: boolean
  contentStyle: ContentStyle
  setContentStyle: ContentStyleSetter
  expertise: string
  setExpertise: (value: string) => void
  interests: string
  setInterests: (value: string) => void
  topicsToAvoid: string
  setTopicsToAvoid: (value: string) => void
  aiPrompt: string
  setAiPrompt: (value: string) => void
  generateContent: (quickAction?: string) => void
}

export function ContentAiPanel({
  isGenerating,
  contentStyle,
  setContentStyle,
  expertise,
  setExpertise,
  interests,
  setInterests,
  topicsToAvoid,
  setTopicsToAvoid,
  aiPrompt,
  setAiPrompt,
  generateContent,
}: Props) {
  if (isGenerating) return <AiGenerationSkeleton />

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Quick Actions</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["improve", "✨", "Improve"],
                ["expand", "➕", "Expand"],
                ["style", "🎨", "Style"],
                ["summarize", "📝", "Summarize"],
              ].map(([action, icon, label]) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start shadow-sm"
                  onClick={() => generateContent(action)}
                  disabled={isGenerating}
                >
                  <span className="mr-2 text-base">{icon}</span>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Card className="border-none bg-muted/30">
            <CardContent className="p-0">
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown className="h-4 w-4" />
                    Style Controls
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <div className="space-y-6">
                    {STYLE_CONTROLS.map(({ key, label, low, high }) => (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">{label}</Label>
                          <Badge variant="secondary" className="text-xs">
                            {contentStyleLabels[key](contentStyle[key])}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base text-muted-foreground">{low}</span>
                          <Slider
                            value={[contentStyle[key]]}
                            onValueChange={([value]) => setContentStyle((previous) => ({ ...previous, [key]: value }))}
                            max={100}
                            step={1}
                            className="w-full style-slider-thumb"
                          />
                          <span className="text-base text-muted-foreground">{high}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card className="border-none bg-muted/30">
            <CardContent className="p-0">
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown className="h-4 w-4" />
                    Personalization
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 px-4 pb-4">
                  {[
                    ["What I'm Good At", "List your key strengths, expertise areas, and what you're known for...", expertise, setExpertise],
                    ["Topics I'm Interested In", "List topics, industries, or areas you're passionate about...", interests, setInterests],
                    ["Topics to Avoid", "List topics, industries, or areas you want to avoid...", topicsToAvoid, setTopicsToAvoid],
                  ].map(([label, placeholder, value, setValue]) => (
                    <div key={label as string} className="space-y-2">
                      <Label className="text-sm font-medium">{label as string}</Label>
                      <Textarea
                        placeholder={placeholder as string}
                        className="min-h-[100px]"
                        value={value as string}
                        onChange={(event) => (setValue as (next: string) => void)(event.target.value)}
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <div className="relative w-full">
          <Label className="sr-only">AI Prompt</Label>
          <Textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Describe what you want the AI to do..."
            className="min-h-[120px] w-full resize-none rounded-2xl border border-input bg-background/80 py-4 pl-4 pr-[54px] text-base backdrop-blur-md transition-all duration-300 ease-in-out focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
            style={{ paddingBottom: "50px" }}
          />
          <div className="absolute bottom-[15px] right-[15px] z-10">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={isGenerating || !aiPrompt.trim()}
              onClick={() => generateContent()}
              className={cn(
                "h-[35.1px] w-[35.1px] rounded-[9999px] transition-[background-color,box-shadow] duration-200",
                aiPrompt.trim() && !isGenerating
                  ? "bg-primary text-primary-foreground opacity-100 shadow-sm hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  : "text-muted-foreground opacity-50 hover:bg-transparent",
              )}
            >
              {isGenerating ? <Loader className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4.5 w-4.5" />}
              <span className="sr-only">Generate Content</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
