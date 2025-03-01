import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Eye, PlayCircle, PenSquare, StopCircle, XCircle, Search } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

interface Experiment {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "draft"
  segments: {
    name: string
    participants: number
  }[]
  startDate: string
  endDate: string | null
  conversion: number | null
  roi: number | null
  previewUrl: string
}

const experiments: Experiment[] = [
  {
    id: "1",
    name: "Pricing Page A/B Test",
    description: "Testing different pricing tiers and presentation",
    status: "active",
    segments: [
      { name: "Small Business Owners", participants: 750 },
      { name: "Startups", participants: 500 }
    ],
    startDate: "2024-01-15",
    endDate: null,
    conversion: 4.2,
    roi: 2.8,
    previewUrl: "https://stripe.com/pricing"
  },
  {
    id: "2",
    name: "Onboarding Flow Optimization",
    description: "Streamlining the user onboarding experience",
    status: "active",
    segments: [
      { name: "Early Adopters", participants: 450 },
      { name: "New Users", participants: 400 }
    ],
    startDate: "2024-01-20",
    endDate: null,
    conversion: 7.8,
    roi: 5.2,
    previewUrl: "https://www.notion.so/onboarding"
  },
  {
    id: "3",
    name: "Feature Announcement Email",
    description: "Testing different messaging for new feature launch",
    status: "completed",
    segments: [
      { name: "Enterprise Decision Makers", participants: 1200 },
      { name: "Team Leads", participants: 900 }
    ],
    startDate: "2023-12-10",
    endDate: "2023-12-31",
    conversion: 2.3,
    roi: 1.5,
    previewUrl: "https://mailchimp.com/features/"
  },
  {
    id: "4",
    name: "Dashboard Redesign",
    description: "Testing new dashboard layout and metrics",
    status: "completed",
    segments: [
      { name: "Product Managers", participants: 380 },
      { name: "Power Users", participants: 400 }
    ],
    startDate: "2023-11-05",
    endDate: "2023-12-05",
    conversion: 12.5,
    roi: 8.3,
    previewUrl: "https://vercel.com/dashboard"
  },
  {
    id: "5",
    name: "AI Feature Adoption",
    description: "Measuring adoption of new AI-powered features",
    status: "draft",
    segments: [
      { name: "Tech Enthusiasts", participants: 0 }
    ],
    startDate: "",
    endDate: null,
    conversion: null,
    roi: null,
    previewUrl: "https://chat.openai.com/"
  },
]

async function getSegments() {
  const supabase = createClient()

  const { data: segments, error } = await supabase
    .from("segments")
    .select("id, name, description")

  if (error) {
    console.error("Error fetching segments:", error)
    return []
  }

  return segments || []
}

export default async function ExperimentsPage() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="h-full">
        <StickyHeader>
          <div className="px-16 pt-0 w-full">
            <div className="flex items-center gap-8">
              <div>
                <TabsList className="bg-gray-100/80 p-1">
                  <TabsTrigger value="all" className="text-sm font-medium">All Experiments</TabsTrigger>
                  <TabsTrigger value="active" className="text-sm font-medium">Active</TabsTrigger>
                  <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                  <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search experiments..." 
                  className="pl-8 w-full text-sm bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" 
                />
                <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-6">
              <div className="space-y-6">
                {experiments.map((experiment) => (
                  <Card 
                    key={experiment.id} 
                    className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                  >
                    <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                      <CardHeader className="pb-2 px-8">
                        <div className="flex justify-between items-start gap-4">
                          <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                            {experiment.name}
                          </CardTitle>
                          <Badge
                            className={
                              experiment.status === "active"
                                ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 shadow-sm text-xs font-semibold px-3 py-1"
                                : experiment.status === "completed"
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-sm text-xs font-semibold px-3 py-1"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm text-xs font-semibold px-3 py-1"
                            }
                          >
                            {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
                          </Badge>
                        </div>
                        <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                          {experiment.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 px-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Participants
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Start Date
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : "Not started"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Conversion
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              ROI
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <div className="px-8 pb-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Running Segments:</p>
                        <div className="flex flex-wrap gap-2">
                          {experiment.segments.map((segment) => (
                            <Badge 
                              key={segment.name}
                              variant="secondary" 
                              className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                            >
                              {segment.name} ({segment.participants.toLocaleString()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CardFooter className="pt-3 px-8">
                        <div className="flex w-full space-x-3">
                          <Button variant="outline" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button variant="destructive" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <StopCircle className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                        </div>
                      </CardFooter>
                    </div>
                    <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                      <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
                        <iframe 
                          src={experiment.previewUrl} 
                          className="w-full h-full"
                          title={`Preview of ${experiment.name}`}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="active" className="space-y-6">
              <div className="space-y-6">
                {experiments.filter(e => e.status === "active").map((experiment) => (
                  <Card 
                    key={experiment.id} 
                    className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                  >
                    <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                      <CardHeader className="pb-2 px-8">
                        <div className="flex justify-between items-start gap-4">
                          <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                            {experiment.name}
                          </CardTitle>
                          <Badge
                            className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 shadow-sm text-xs font-semibold px-3 py-1"
                          >
                            Active
                          </Badge>
                        </div>
                        <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                          {experiment.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 px-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Participants
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Start Date
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : "Not started"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Conversion
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              ROI
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <div className="px-8 pb-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Running Segments:</p>
                        <div className="flex flex-wrap gap-2">
                          {experiment.segments.map((segment) => (
                            <Badge 
                              key={segment.name}
                              variant="secondary" 
                              className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                            >
                              {segment.name} ({segment.participants.toLocaleString()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CardFooter className="pt-3 px-8">
                        <div className="flex w-full space-x-3">
                          <Button variant="outline" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button variant="destructive" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <StopCircle className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                        </div>
                      </CardFooter>
                    </div>
                    <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                      <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
                        <iframe 
                          src={experiment.previewUrl} 
                          className="w-full h-full"
                          title={`Preview of ${experiment.name}`}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="completed" className="space-y-6">
              <div className="space-y-6">
                {experiments.filter(e => e.status === "completed").map((experiment) => (
                  <Card 
                    key={experiment.id} 
                    className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                  >
                    <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                      <CardHeader className="pb-2 px-8">
                        <div className="flex justify-between items-start gap-4">
                          <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                            {experiment.name}
                          </CardTitle>
                          <Badge
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-sm text-xs font-semibold px-3 py-1"
                          >
                            Completed
                          </Badge>
                        </div>
                        <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                          {experiment.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 px-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Participants
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Duration
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.startDate && experiment.endDate 
                                ? `${Math.ceil((new Date(experiment.endDate).getTime() - new Date(experiment.startDate).getTime()) / (1000 * 60 * 60 * 24))} days` 
                                : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Conversion
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              ROI
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <div className="px-8 pb-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Segments:</p>
                        <div className="flex flex-wrap gap-2">
                          {experiment.segments.map((segment) => (
                            <Badge 
                              key={segment.name}
                              variant="secondary" 
                              className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                            >
                              {segment.name} ({segment.participants.toLocaleString()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CardFooter className="pt-3 px-8">
                        <div className="flex w-full space-x-3">
                          <Button variant="outline" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <Eye className="mr-2 h-4 w-4" />
                            View Results
                          </Button>
                          <Button variant="ghost" className="flex-1 hover:bg-destructive hover:text-destructive-foreground hover:shadow-sm transition-all text-sm font-medium h-10">
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardFooter>
                    </div>
                    <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                      <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
                        <iframe 
                          src={experiment.previewUrl} 
                          className="w-full h-full"
                          title={`Preview of ${experiment.name}`}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="draft" className="space-y-6">
              <div className="space-y-6">
                {experiments.filter(e => e.status === "draft").map((experiment) => (
                  <Card 
                    key={experiment.id} 
                    className="group flex flex-col md:flex-row w-full h-[400px] hover:shadow-lg transition-all duration-200 hover:border-gray-300 bg-white/80 backdrop-blur-sm"
                  >
                    <div className="flex flex-col md:w-1/3 border-r border-gray-100">
                      <CardHeader className="pb-2 px-8">
                        <div className="flex justify-between items-start gap-4">
                          <CardTitle className="text-xl font-medium text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                            {experiment.name}
                          </CardTitle>
                          <Badge
                            className="bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm text-xs font-semibold px-3 py-1"
                          >
                            Draft
                          </Badge>
                        </div>
                        <CardDescription className="text-gray-500 mt-2 text-sm leading-relaxed group-hover:text-gray-600">
                          {experiment.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 px-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                              Status
                            </p>
                            <p className="text-base font-semibold text-gray-800">
                              Not started
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <div className="px-8 pb-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Target Segments:</p>
                        <div className="flex flex-wrap gap-2">
                          {experiment.segments.map((segment) => (
                            <Badge 
                              key={segment.name}
                              variant="secondary" 
                              className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                            >
                              {segment.name} ({segment.participants.toLocaleString()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CardFooter className="pt-3 px-8">
                        <div className="flex w-full space-x-3">
                          <Button variant="outline" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <PenSquare className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" className="flex-1 hover:shadow-sm transition-all text-sm font-medium h-10">
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Start
                          </Button>
                          <Button variant="ghost" className="flex-1 hover:bg-destructive hover:text-destructive-foreground hover:shadow-sm transition-all text-sm font-medium h-10">
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardFooter>
                    </div>
                    <div className="md:w-2/3 h-full p-4 bg-gray-50/30 rounded-r-lg">
                      <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200/80 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
                        <iframe 
                          src={experiment.previewUrl} 
                          className="w-full h-full"
                          title={`Preview of ${experiment.name}`}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 