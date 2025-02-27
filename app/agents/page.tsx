import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { PlusCircle, Search, MessageSquare, Pencil } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { StickyHeader } from "@/app/components/ui/sticky-header"

interface Agent {
  id: string
  name: string
  description: string
  type: "sales" | "support" | "marketing"
  status: "active" | "inactive" | "training"
  conversations: number
  successRate: number
  lastActive: string
}

const agents: Agent[] = [
  {
    id: "1",
    name: "Sales Assistant",
    description: "Helps qualify leads and answer product questions",
    type: "sales",
    status: "active",
    conversations: 342,
    successRate: 78,
    lastActive: "2024-01-25",
  },
  {
    id: "2",
    name: "Support Agent",
    description: "Handles customer support inquiries and troubleshooting",
    type: "support",
    status: "active",
    conversations: 567,
    successRate: 92,
    lastActive: "2024-01-25",
  },
  {
    id: "3",
    name: "Marketing Specialist",
    description: "Provides information about marketing campaigns",
    type: "marketing",
    status: "active",
    conversations: 189,
    successRate: 85,
    lastActive: "2024-01-24",
  },
  {
    id: "4",
    name: "Product Expert",
    description: "Detailed product information and feature explanations",
    type: "sales",
    status: "training",
    conversations: 45,
    successRate: 67,
    lastActive: "2024-01-20",
  },
  {
    id: "5",
    name: "Technical Support",
    description: "Advanced technical troubleshooting and guidance",
    type: "support",
    status: "inactive",
    conversations: 231,
    successRate: 88,
    lastActive: "2024-01-15",
  },
]

export default function AgentsPage() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" className="space-y-4">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Agents</TabsTrigger>
                  <TabsTrigger value="sales">Sales</TabsTrigger>
                  <TabsTrigger value="support">Support</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search agents..." className="pl-8 w-full" />
                <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <Card key={agent.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/agent-${agent.id}.png`} alt={agent.name} />
                            <AvatarFallback>
                              {agent.name.split(" ").map(name => name[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xl">{agent.name}</CardTitle>
                            <CardDescription>{agent.description}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          className={
                            agent.status === "active"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : agent.status === "training"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                          }
                        >
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Type
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {agent.type}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Conversations
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.conversations}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Success Rate
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.successRate}%
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Last Active
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(agent.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Pencil className="h-4 w-4 mr-2" />
                        Manage Agent
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="sales" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.filter(a => a.type === "sales").map((agent) => (
                  <Card key={agent.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/agent-${agent.id}.png`} alt={agent.name} />
                            <AvatarFallback>
                              {agent.name.split(" ").map(name => name[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xl">{agent.name}</CardTitle>
                            <CardDescription>{agent.description}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          className={
                            agent.status === "active"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : agent.status === "training"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                          }
                        >
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Type
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {agent.type}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Conversations
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.conversations}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Success Rate
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.successRate}%
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Last Active
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(agent.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Pencil className="h-4 w-4 mr-2" />
                        Manage Agent
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="support" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.filter(a => a.type === "support").map((agent) => (
                  <Card key={agent.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/agent-${agent.id}.png`} alt={agent.name} />
                            <AvatarFallback>
                              {agent.name.split(" ").map(name => name[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xl">{agent.name}</CardTitle>
                            <CardDescription>{agent.description}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          className={
                            agent.status === "active"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : agent.status === "training"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                          }
                        >
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Type
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {agent.type}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Conversations
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.conversations}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Success Rate
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.successRate}%
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Last Active
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(agent.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Pencil className="h-4 w-4 mr-2" />
                        Manage Agent
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="marketing" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.filter(a => a.type === "marketing").map((agent) => (
                  <Card key={agent.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/agent-${agent.id}.png`} alt={agent.name} />
                            <AvatarFallback>
                              {agent.name.split(" ").map(name => name[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xl">{agent.name}</CardTitle>
                            <CardDescription>{agent.description}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          className={
                            agent.status === "active"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : agent.status === "training"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                          }
                        >
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Type
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {agent.type}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Conversations
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.conversations}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Success Rate
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {agent.successRate}%
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Last Active
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(agent.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Pencil className="h-4 w-4 mr-2" />
                        Manage Agent
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                    </CardFooter>
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