import type { AgentActivity } from "@/app/types/agents"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Tag, Check } from "@/app/components/ui/icons"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Switch } from "@/app/components/ui/switch"
import { TabsContent } from "@/app/components/ui/tabs"
import { cn } from "@/lib/utils"

type Props = {
  activities: AgentActivity[]; search: string; saving: boolean
  onChange: (activities: AgentActivity[]) => void; onSave: () => void
}

export function EditorActivitiesTab({ activities, search, saving, onChange, onSave }: Props) {
  const query = search.toLowerCase()
  return <TabsContent value="activities" className="space-y-4">
    <SectionCard className="mb-8">
      <SectionCardHeader title="Activities" description="Configure the activities this agent can perform" />
      <SectionCardContent>
        {activities.length ? <div className="space-y-3">
          {activities.filter(({ name, description }) => name.toLowerCase().includes(query) || description.toLowerCase().includes(query))
            .map(({ id, name, description, status }) => <div key={id} className="border rounded-lg p-3 flex items-center">
              <div className="flex-1 flex items-center space-x-3">
                <Check className={cn("h-4 w-4", status === "available" ? "text-primary" : "text-muted-foreground/30")} />
                <div><h4 className="font-medium text-sm">{name}</h4><p className="text-muted-foreground text-xs">{description}</p></div>
              </div>
              <Switch aria-label={`Toggle ${name}`} checked={status === "available"} onCheckedChange={(enabled) =>
                onChange(activities.map((item) => item.id === id ? { ...item, status: enabled ? "available" : "deprecated" } : item))} />
            </div>)}
        </div> : <EmptyCard icon={<Tag className="h-10 w-10 text-muted-foreground" />} title="No activities configured"
          contentClassName="mb-4" description="Add activities to specify what this agent can do" className="flex flex-col items-center justify-center py-8" />}
      </SectionCardContent>
      <ActionFooter><Button variant="outline" type="button" size="sm" disabled={saving} onClick={onSave}>
        {saving ? "Saving..." : "Save Activities"}
      </Button></ActionFooter>
    </SectionCard>
  </TabsContent>
}