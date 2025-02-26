import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Eye, PlayCircle, PenSquare, StopCircle, XCircle } from "lucide-react"

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

export default function ExperimentsPage() {
  return (
    <div className="space-y-4 pt-6 px-8">
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Experiments</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {experiments.map((experiment) => (
              <Card key={experiment.id} className="flex flex-col md:flex-row w-full h-[400px]">
                <div className="flex flex-col md:w-1/3">
                  <CardHeader className="pb-2 px-8">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{experiment.name}</CardTitle>
                      <Badge
                        className={
                          experiment.status === "active"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : experiment.status === "completed"
                            ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                        }
                      >
                        {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
                      </Badge>
                    </div>
                    <CardDescription>{experiment.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 px-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Participants
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Start Date
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : "Not started"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Conversion
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          ROI
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-8 pb-4">
                    <p className="text-sm font-medium mb-2">Running Segments:</p>
                    <div className="flex flex-wrap gap-2">
                      {experiment.segments.map((segment) => (
                        <Badge 
                          key={segment.name}
                          variant="secondary" 
                          className="px-2.5 py-0.5 text-xs font-medium"
                        >
                          {segment.name} ({segment.participants.toLocaleString()})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardFooter className="pt-2">
                    <div className="flex w-full space-x-2">
                      <Button variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      <Button variant="destructive" className="flex-1">
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                  </CardFooter>
                </div>
                <div className="md:w-2/3 h-full p-4 bg-gray-50 rounded-r-lg">
                  <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
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
        <TabsContent value="active" className="space-y-4">
          <div className="space-y-4">
            {experiments.filter(e => e.status === "active").map((experiment) => (
              <Card key={experiment.id} className="flex flex-col md:flex-row w-full h-[400px]">
                <div className="flex flex-col md:w-1/3">
                  <CardHeader className="pb-2 px-8">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{experiment.name}</CardTitle>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Active
                      </Badge>
                    </div>
                    <CardDescription>{experiment.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 px-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Participants
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Start Date
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : "Not started"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Conversion
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          ROI
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-8 pb-4">
                    <p className="text-sm font-medium mb-2">Running Segments:</p>
                    <div className="flex flex-wrap gap-2">
                      {experiment.segments.map((segment) => (
                        <Badge 
                          key={segment.name}
                          variant="secondary" 
                          className="px-2.5 py-0.5 text-xs font-medium"
                        >
                          {segment.name} ({segment.participants.toLocaleString()})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardFooter className="pt-2">
                    <div className="flex w-full space-x-2">
                      <Button variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      <Button variant="destructive" className="flex-1">
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                  </CardFooter>
                </div>
                <div className="md:w-2/3 h-full p-4 bg-gray-50 rounded-r-lg">
                  <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
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
        <TabsContent value="completed" className="space-y-4">
          <div className="space-y-4">
            {experiments.filter(e => e.status === "completed").map((experiment) => (
              <Card key={experiment.id} className="flex flex-col md:flex-row w-full h-[400px]">
                <div className="flex flex-col md:w-1/3">
                  <CardHeader className="pb-2 px-8">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{experiment.name}</CardTitle>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Completed
                      </Badge>
                    </div>
                    <CardDescription>{experiment.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 px-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Participants
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.segments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Duration
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.startDate && experiment.endDate 
                            ? `${Math.ceil((new Date(experiment.endDate).getTime() - new Date(experiment.startDate).getTime()) / (1000 * 60 * 60 * 24))} days` 
                            : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Conversion
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          ROI
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {experiment.roi !== null ? `${experiment.roi}x` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-8 pb-4">
                    <p className="text-sm font-medium mb-2">Segments:</p>
                    <div className="flex flex-wrap gap-2">
                      {experiment.segments.map((segment) => (
                        <Badge 
                          key={segment.name}
                          variant="secondary" 
                          className="px-2.5 py-0.5 text-xs font-medium"
                        >
                          {segment.name} ({segment.participants.toLocaleString()})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardFooter className="pt-2">
                    <div className="flex w-full space-x-2">
                      <Button variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" />
                        View Results
                      </Button>
                      <Button variant="ghost" className="flex-1 hover:bg-destructive hover:text-destructive-foreground">
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardFooter>
                </div>
                <div className="md:w-2/3 h-full p-4 bg-gray-50 rounded-r-lg">
                  <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
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
        <TabsContent value="draft" className="space-y-4">
          <div className="space-y-4">
            {experiments.filter(e => e.status === "draft").map((experiment) => (
              <Card key={experiment.id} className="flex flex-col md:flex-row w-full h-[400px]">
                <div className="flex flex-col md:w-1/3">
                  <CardHeader className="pb-2 px-8">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{experiment.name}</CardTitle>
                      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                        Draft
                      </Badge>
                    </div>
                    <CardDescription>{experiment.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 px-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Status
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Not started
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-8 pb-4">
                    <p className="text-sm font-medium mb-2">Target Segments:</p>
                    <div className="flex flex-wrap gap-2">
                      {experiment.segments.map((segment) => (
                        <Badge 
                          key={segment.name}
                          variant="secondary" 
                          className="px-2.5 py-0.5 text-xs font-medium"
                        >
                          {segment.name} ({segment.participants.toLocaleString()})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardFooter className="pt-2 flex space-x-2">
                    <Button variant="outline" className="flex-1">
                      <PenSquare className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button className="flex-1">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                    <Button variant="ghost" className="flex-1 hover:bg-destructive hover:text-destructive-foreground">
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </CardFooter>
                </div>
                <div className="md:w-2/3 h-full p-4 bg-gray-50 rounded-r-lg">
                  <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
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
      </Tabs>
    </div>
  )
} 