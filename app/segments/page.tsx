  "use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ChevronDown, ChevronRight, ChevronUp, Copy, Globe, PlusCircle, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"
import { useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Switch } from "@/app/components/ui/switch"

type AdPlatform = "facebook" | "google" | "linkedin" | "twitter"

interface Segment {
  id: string
  name: string
  description: string
  audience: string
  size: number
  engagement: number
  createdAt: string
  keywords: {
    facebook: string[]
    google: string[]
    linkedin: string[]
    twitter: string[]
  }
  hotTopics: {
    blog: string[]
    newsletter: string[]
  }
}

const segments: Segment[] = [
  {
    id: "1",
    name: "Early Adopters",
    description: "Tech-savvy users who are first to try new products",
    audience: "Tech Enthusiasts",
    size: 2500,
    engagement: 78,
    createdAt: "2023-10-15",
    keywords: {
      facebook: ["innovation", "tech trends", "early access", "beta testing", "product launch"],
      google: ["new technology", "tech innovation", "early adopter", "beta program", "tech preview"],
      linkedin: ["technology pioneers", "innovation leaders", "early tech adopters", "product beta", "tech trends"],
      twitter: ["#TechTrends", "#Innovation", "#EarlyAdopter", "#ProductLaunch", "#BetaTesting"]
    },
    hotTopics: {
      blog: [
        "The Future of Tech: What Early Adopters Are Loving",
        "5 Emerging Technologies Worth Your Attention",
        "Why Beta Testing is Critical for Product Success",
        "Innovation Trends: A Deep Dive into Early Adoption",
        "From Early Adopter to Product Champion"
      ],
      newsletter: [
        "Weekly Tech Radar: What's Hot in Innovation",
        "Beta Testing Opportunities Roundup",
        "Early Access Exclusive Updates",
        "Innovation Insider Weekly Brief"
      ]
    }
  },
  {
    id: "2",
    name: "Enterprise Decision Makers",
    description: "C-level executives in large corporations",
    audience: "Enterprise",
    size: 1200,
    engagement: 45,
    createdAt: "2023-11-02",
    keywords: {
      facebook: ["enterprise solutions", "executive leadership", "corporate strategy", "business transformation", "C-suite"],
      google: ["enterprise software", "executive decision makers", "C-level", "corporate leadership", "business strategy"],
      linkedin: ["enterprise leadership", "executive decision making", "C-suite professionals", "corporate strategy", "business transformation"],
      twitter: ["#EnterpriseTech", "#ExecutiveLeadership", "#CorporateStrategy", "#BusinessTransformation", "#CSuite"]
    },
    hotTopics: {
      blog: [
        "Digital Transformation: A C-Suite Perspective",
        "Enterprise Strategy in the AI Era",
        "Leadership Insights: Navigating Corporate Change",
        "The Future of Enterprise Technology",
        "Strategic Decision Making in Uncertain Times"
      ],
      newsletter: [
        "Executive Brief: Weekly Market Insights",
        "Enterprise Technology Trends",
        "C-Suite Strategy Digest",
        "Corporate Innovation Weekly"
      ]
    }
  },
  {
    id: "3",
    name: "Small Business Owners",
    description: "Entrepreneurs and small business operators",
    audience: "SMB",
    size: 3800,
    engagement: 62,
    createdAt: "2023-11-18",
    keywords: {
      facebook: ["small business", "entrepreneur", "business growth", "local business", "startup"],
      google: ["small business solutions", "entrepreneur tools", "business growth strategies", "local business marketing", "startup resources"],
      linkedin: ["small business network", "entrepreneur community", "business growth", "local business owners", "startup founders"],
      twitter: ["#SmallBusiness", "#Entrepreneur", "#BusinessGrowth", "#LocalBusiness", "#Startup"]
    },
    hotTopics: {
      blog: [
        "Small Business Growth Strategies for 2024",
        "How to Scale Your Local Business",
        "Essential Tools for Modern Entrepreneurs",
        "From Startup to Success: Real Stories",
        "Marketing on a Budget: SMB Guide"
      ],
      newsletter: [
        "Weekly SMB Success Stories",
        "Local Business Opportunities",
        "Entrepreneur's Resource Roundup",
        "Small Business Tech Updates"
      ]
    }
  },
  {
    id: "4",
    name: "Marketing Professionals",
    description: "Marketing managers and specialists",
    audience: "B2B",
    size: 2100,
    engagement: 56,
    createdAt: "2023-12-05",
    keywords: {
      facebook: ["marketing strategy", "digital marketing", "marketing tools", "campaign management", "marketing ROI"],
      google: ["marketing professionals", "digital marketing tools", "marketing strategy", "campaign optimization", "marketing analytics"],
      linkedin: ["marketing leadership", "digital marketing experts", "marketing strategy", "campaign management", "marketing analytics"],
      twitter: ["#MarketingStrategy", "#DigitalMarketing", "#MarketingTools", "#CampaignManagement", "#MarketingROI"]
    },
    hotTopics: {
      blog: [
        "Digital Marketing Trends to Watch",
        "AI in Marketing: A Practical Guide",
        "Data-Driven Marketing Strategies",
        "Content Marketing Excellence",
        "Marketing Analytics Deep Dive"
      ],
      newsletter: [
        "Marketing Tech Weekly",
        "Campaign Performance Insights",
        "Digital Marketing Innovation Digest",
        "Marketing Analytics Report"
      ]
    }
  },
  {
    id: "5",
    name: "Product Managers",
    description: "Product leaders in tech companies",
    audience: "Tech",
    size: 1800,
    engagement: 71,
    createdAt: "2024-01-10",
    keywords: {
      facebook: ["product management", "product strategy", "product development", "user experience", "product roadmap"],
      google: ["product management tools", "product strategy framework", "product development process", "UX design", "product roadmap planning"],
      linkedin: ["product leadership", "product strategy", "product development", "user experience design", "product roadmap"],
      twitter: ["#ProductManagement", "#ProductStrategy", "#ProductDevelopment", "#UXDesign", "#ProductRoadmap"]
    },
    hotTopics: {
      blog: [
        "Product-Led Growth Strategies",
        "Building User-Centric Products",
        "Product Metrics That Matter",
        "From MVP to Enterprise Product",
        "Product Strategy in the AI Era"
      ],
      newsletter: [
        "Product Innovation Weekly",
        "UX Research Insights",
        "Product Management Trends",
        "Tech Product Leaders Digest"
      ]
    }
  },
]

export default function SegmentsPage() {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [selectedAdPlatforms, setSelectedAdPlatforms] = useState<Record<string, AdPlatform>>(
    segments.reduce((acc, segment) => ({
      ...acc,
      [segment.id]: "facebook" as AdPlatform
    }), {} as Record<string, AdPlatform>)
  )
  const [activeSegments, setActiveSegments] = useState<Record<string, boolean>>(
    segments.reduce((acc, segment) => ({
      ...acc,
      [segment.id]: segment.engagement > 60
    }), {} as Record<string, boolean>)
  )
  
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handlePlatformChange = (id: string, platform: AdPlatform) => {
    setSelectedAdPlatforms(prev => ({
      ...prev,
      [id]: platform
    }))
  }

  const toggleSegmentStatus = (id: string) => {
    setActiveSegments(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const copyToClipboard = (keywords: string[]) => {
    navigator.clipboard.writeText(keywords.join(", "))
  }

  const viewExperiment = (id: string) => {
    // Esta función se implementaría para ver el experimento
    console.log(`Viewing experiment for segment ${id}`)
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex justify-between">
          <TabsList>
            <TabsTrigger value="all">All Segments</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
          </TabsList>
          <div className="relative w-64 pr-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search segments..." className="pl-8" />
            <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {segments.map((segment) => (
              <Collapsible
                key={segment.id}
                open={expandedRows[segment.id]}
                onOpenChange={() => toggleRow(segment.id)}
                className="w-full"
              >
                <Card className="cursor-pointer border border-border hover:border-foreground/20 transition-colors pl-6" onClick={() => toggleRow(segment.id)}>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center p-2">
                      {expandedRows[segment.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                    <CardContent className="flex-1 p-6 flex flex-wrap md:flex-nowrap items-center gap-4">
                      <div className="w-full md:w-1/4 min-w-[200px] max-w-[300px]">
                        <h3 className="font-medium truncate">{segment.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{segment.description}</p>
                      </div>
                      <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-3/4 justify-between">
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center min-w-[40px] max-w-[40px]">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewExperiment(segment.id)}
                            className="p-1 h-auto"
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="min-w-[120px] max-w-[120px]">
                          <p className="text-sm font-medium">Audience</p>
                          <p className="text-sm text-muted-foreground truncate">{segment.audience}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Size</p>
                          <p className="text-sm text-muted-foreground">{segment.size}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Engagement</p>
                          <p className="text-sm text-muted-foreground">{segment.engagement}%</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Created</p>
                          <p className="text-sm text-muted-foreground">{new Date(segment.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 min-w-[160px] max-w-[160px]">
                          <p className="text-sm font-medium">Status</p>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={activeSegments[segment.id]} 
                              onCheckedChange={() => toggleSegmentStatus(segment.id)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {activeSegments[segment.id] ? "Active" : "Draft"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">Ad Platform</p>
                            <Select
                              value={selectedAdPlatforms[segment.id]}
                              onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                            >
                              <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="facebook">Facebook Ads</SelectItem>
                                <SelectItem value="google">Google Ads</SelectItem>
                                <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                <SelectItem value="twitter">Twitter Ads</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(segment.keywords[selectedAdPlatforms[segment.id]])}
                            className="flex items-center"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy to Clipboard
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="my-2">
                            <h4 className="font-medium">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {segment.keywords[selectedAdPlatforms[segment.id]].map((keyword, idx) => (
                              <Badge key={idx} variant="outline" className="px-2 py-1">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 mt-6 border-t pt-4">
                          <h4 className="font-medium">Hot Topics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Blog Ideas</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.blog.map((topic, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked blog topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Newsletter Content</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.newsletter.map((topic, idx) => (
                                  <Badge 
                                    key={idx}
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked newsletter topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active" className="space-y-4">
          <div className="space-y-4">
            {segments.filter(s => s.engagement > 60).map((segment) => (
              <Collapsible
                key={segment.id}
                open={expandedRows[segment.id]}
                onOpenChange={() => toggleRow(segment.id)}
                className="w-full"
              >
                <Card className="cursor-pointer border border-border hover:border-foreground/20 transition-colors pl-6" onClick={() => toggleRow(segment.id)}>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center p-2">
                      {expandedRows[segment.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                    <CardContent className="flex-1 p-6 flex flex-wrap md:flex-nowrap items-center gap-4">
                      <div className="w-full md:w-1/4 min-w-[200px] max-w-[300px]">
                        <h3 className="font-medium truncate">{segment.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{segment.description}</p>
                      </div>
                      <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-3/4 justify-between">
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center min-w-[40px] max-w-[40px]">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewExperiment(segment.id)}
                            className="p-1 h-auto"
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="min-w-[120px] max-w-[120px]">
                          <p className="text-sm font-medium">Audience</p>
                          <p className="text-sm text-muted-foreground truncate">{segment.audience}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Size</p>
                          <p className="text-sm text-muted-foreground">{segment.size}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Engagement</p>
                          <p className="text-sm text-muted-foreground">{segment.engagement}%</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Created</p>
                          <p className="text-sm text-muted-foreground">{new Date(segment.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 min-w-[160px] max-w-[160px]">
                          <p className="text-sm font-medium">Status</p>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={activeSegments[segment.id]} 
                              onCheckedChange={() => toggleSegmentStatus(segment.id)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {activeSegments[segment.id] ? "Active" : "Draft"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">Ad Platform</p>
                            <Select
                              value={selectedAdPlatforms[segment.id]}
                              onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                            >
                              <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="facebook">Facebook Ads</SelectItem>
                                <SelectItem value="google">Google Ads</SelectItem>
                                <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                <SelectItem value="twitter">Twitter Ads</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(segment.keywords[selectedAdPlatforms[segment.id]])}
                            className="flex items-center"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy to Clipboard
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="my-2">
                            <h4 className="font-medium">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {segment.keywords[selectedAdPlatforms[segment.id]].map((keyword, idx) => (
                              <Badge key={idx} variant="outline" className="px-2 py-1">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 mt-6 border-t pt-4">
                          <h4 className="font-medium">Hot Topics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Blog Ideas</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.blog.map((topic, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked blog topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Newsletter Content</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.newsletter.map((topic, idx) => (
                                  <Badge 
                                    key={idx}
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked newsletter topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="draft" className="space-y-4">
          <div className="space-y-4">
            {segments.filter(s => s.engagement <= 60).map((segment) => (
              <Collapsible
                key={segment.id}
                open={expandedRows[segment.id]}
                onOpenChange={() => toggleRow(segment.id)}
                className="w-full"
              >
                <Card className="cursor-pointer border border-border hover:border-foreground/20 transition-colors pl-6" onClick={() => toggleRow(segment.id)}>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center p-2">
                      {expandedRows[segment.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                    <CardContent className="flex-1 p-6 flex flex-wrap md:flex-nowrap items-center gap-4">
                      <div className="w-full md:w-1/4 min-w-[200px] max-w-[300px]">
                        <h3 className="font-medium truncate">{segment.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{segment.description}</p>
                      </div>
                      <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-3/4 justify-between">
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center min-w-[40px] max-w-[40px]">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewExperiment(segment.id)}
                            className="p-1 h-auto"
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="min-w-[120px] max-w-[120px]">
                          <p className="text-sm font-medium">Audience</p>
                          <p className="text-sm text-muted-foreground truncate">{segment.audience}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Size</p>
                          <p className="text-sm text-muted-foreground">{segment.size}</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Engagement</p>
                          <p className="text-sm text-muted-foreground">{segment.engagement}%</p>
                        </div>
                        <div className="min-w-[100px] max-w-[100px]">
                          <p className="text-sm font-medium">Created</p>
                          <p className="text-sm text-muted-foreground">{new Date(segment.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 min-w-[160px] max-w-[160px]">
                          <p className="text-sm font-medium">Status</p>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={activeSegments[segment.id]} 
                              onCheckedChange={() => toggleSegmentStatus(segment.id)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {activeSegments[segment.id] ? "Active" : "Draft"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">Ad Platform</p>
                            <Select
                              value={selectedAdPlatforms[segment.id]}
                              onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                            >
                              <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="facebook">Facebook Ads</SelectItem>
                                <SelectItem value="google">Google Ads</SelectItem>
                                <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                <SelectItem value="twitter">Twitter Ads</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(segment.keywords[selectedAdPlatforms[segment.id]])}
                            className="flex items-center"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy to Clipboard
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="my-2">
                            <h4 className="font-medium">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {segment.keywords[selectedAdPlatforms[segment.id]].map((keyword, idx) => (
                              <Badge key={idx} variant="outline" className="px-2 py-1">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 mt-6 border-t pt-4">
                          <h4 className="font-medium">Hot Topics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Blog Ideas</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.blog.map((topic, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked blog topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Newsletter Content</h5>
                              <div className="flex flex-wrap gap-2">
                                {segment.hotTopics.newsletter.map((topic, idx) => (
                                  <Badge 
                                    key={idx}
                                    variant="secondary"
                                    className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                    onClick={() => console.log('Clicked newsletter topic:', topic)}
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 