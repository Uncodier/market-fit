"use client"

import { ContentPerformancePanel } from "../../components/ContentPerformancePanel"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import type {
  CampaignOption,
  ContentEditForm,
  ContentStyle,
  ContentStyleSetter,
  EditFormSetter,
  SegmentOption,
} from "../content-item-types"
import { ContentAiPanel } from "./ContentAiPanel"
import { ContentDetailsPanel } from "./ContentDetailsPanel"

type Props = {
  content: any
  editForm: ContentEditForm
  setEditForm: EditFormSetter
  campaigns: CampaignOption[]
  segments: SegmentOption[]
  editorsReady: boolean
  setHasUserMadeChanges: (changed: boolean) => void
  outstandPostId?: string
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

export function ContentRightPanel(props: Props) {
  return (
    <div className="flex h-full w-80 flex-col border-l bg-muted/30">
      <Tabs defaultValue="ai" className="flex h-full flex-col">
        <div className="flex h-[71px] items-center justify-center border-b px-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="px-1 text-xs">AI Assistant</TabsTrigger>
            <TabsTrigger value="details" className="px-1 text-xs">Details</TabsTrigger>
            <TabsTrigger value="performance" className="px-1 text-xs">Performance</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-hidden">
          <TabsContent value="ai" className="mt-0 h-full">
            <ContentAiPanel {...props} />
          </TabsContent>
          <TabsContent value="details" className="mt-0 h-full">
            <ContentDetailsPanel
              content={props.content}
              editForm={props.editForm}
              setEditForm={props.setEditForm}
              campaigns={props.campaigns}
              segments={props.segments}
              editorsReady={props.editorsReady}
              setHasUserMadeChanges={props.setHasUserMadeChanges}
            />
          </TabsContent>
          <TabsContent value="performance" className="mt-0 h-full">
            <ScrollArea className="h-full">
              <ContentPerformancePanel
                contentId={props.content.id}
                outstandPostId={props.outstandPostId}
              />
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
