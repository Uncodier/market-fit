import React from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { 
  Tag, 
  Check, 
  Eye, 
  FileText, 
  MessageSquare, 
  User, 
  Users, 
  Phone, 
  Mail,
  Clock,
  AlertCircle,
  CalendarIcon,
  PieChart
} from "@/app/components/ui/icons"
import { Progress } from "@/app/components/ui/progress"
import { TASK_TYPES, JOURNEY_STAGES } from "../types"
import { useTasks, TasksProvider } from "../context/TasksContext"
import { formatDistanceToNow } from "date-fns"

interface JourneySummaryProps {
  leadId: string;
}

// NPS indicator for marker on the scale
const NPSIndicator = ({ score }: { score: number }) => {
  // Calculate percentage position on the scale (0-10 to 0-100%)
  const position = (score / 10) * 100;
  
  return (
    <div className="relative h-6 w-full">
      <div className="absolute" style={{ left: `${position}%`, top: '-10px', transform: 'translateX(-50%)' }}>
        <div className="h-5 w-5 bg-primary rounded-full flex items-center justify-center">
          <PieChart className="h-3 w-3 text-white" />
        </div>
      </div>
    </div>
  )
}

function JourneySummaryContent({ leadId }: JourneySummaryProps) {
  const { getTasksByLeadId } = useTasks()
  
  // Get tasks for this lead
  const tasks = getTasksByLeadId(leadId)
  
  // Calculate stage progress
  const stageProgress = React.useMemo(() => {
    const totalStages = JOURNEY_STAGES.length
    
    if (tasks.length === 0) return 0
    
    const stagesWithCompletedTasks = new Set()
    
    tasks.forEach(task => {
      if (task.status === "completed") {
        stagesWithCompletedTasks.add(task.stage)
      }
    })
    
    return Math.round((stagesWithCompletedTasks.size / totalStages) * 100)
  }, [tasks])
  
  // Calculate task stats
  const taskStats = React.useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(task => task.status === "completed").length
    const inProgress = tasks.filter(task => task.status === "in_progress").length
    const pending = tasks.filter(task => task.status === "pending").length
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      total,
      completed,
      inProgress,
      pending,
      completionRate
    }
  }, [tasks])
  
  // Group tasks by type
  const tasksByType = React.useMemo(() => {
    const result: Record<string, number> = {}
    
    tasks.forEach(task => {
      if (result[task.type]) {
        result[task.type]++
      } else {
        result[task.type] = 1
      }
    })
    
    return result
  }, [tasks])
  
  // Find upcoming tasks
  const upcomingTasks = React.useMemo(() => {
    return tasks
      .filter(task => task.status === "pending" || task.status === "in_progress")
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      .slice(0, 3)
  }, [tasks])
  
  // Calculate total value of opportunities
  const totalValue = React.useMemo(() => {
    return tasks
      .filter(task => task.amount && ["quote", "contract", "payment"].includes(task.type))
      .reduce((sum, task) => sum + (task.amount || 0), 0)
  }, [tasks])
  
  // Mock NPS data - in a real app, this would come from an API or database
  const npsScore = React.useMemo(() => {
    // For demo purposes, generate a random score between 0 and 10
    return Math.floor(Math.random() * 11);
  }, [leadId]);
  
  // Helper function to determine NPS category and color classes
  const getNPSCategory = (score: number) => {
    if (score >= 9) return { 
      category: "Promoter", 
      bgColor: "bg-green-100", 
      textColor: "text-green-600" 
    };
    if (score >= 7) return { 
      category: "Passive", 
      bgColor: "bg-yellow-100", 
      textColor: "text-yellow-600" 
    };
    return { 
      category: "Detractor", 
      bgColor: "bg-red-100", 
      textColor: "text-red-600" 
    };
  };
  
  const npsInfo = getNPSCategory(npsScore);
  
  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Journey Progress</h4>
          <Progress value={stageProgress} className="h-2 mb-2" />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Awareness</span>
            <span>Consideration</span>
            <span>Decision</span>
            <span>Purchase</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Task Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-2">Task Completion</h4>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taskStats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Completion rate</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{taskStats.completed}/{taskStats.total}</p>
                <p className="text-xs text-muted-foreground">Tasks completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-2">Task Status</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mb-1">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs font-medium">{taskStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mb-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs font-medium">{taskStats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center mb-1">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </div>
                <p className="text-xs font-medium">{taskStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Task Types */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Task Types</h4>
          <div className="space-y-2">
            {Object.entries(tasksByType).length > 0 ? (
              Object.entries(tasksByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([type, count]) => {
                  const taskType = TASK_TYPES.find(t => t.id === type)
                  return (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center">
                        <div className={`h-6 w-6 rounded-full mr-2 flex items-center justify-center ${
                          type === "email" ? "bg-blue-100 text-blue-600" :
                          type === "call" ? "bg-green-100 text-green-600" :
                          type === "meeting" ? "bg-purple-100 text-purple-600" :
                          type === "demo" ? "bg-yellow-100 text-yellow-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {type === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : type === "call" ? (
                            <Phone className="h-3 w-3" />
                          ) : type === "meeting" ? (
                            <Users className="h-3 w-3" />
                          ) : type === "contract" || type === "quote" || type === "payment" ? (
                            <Tag className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                        </div>
                        <span className="text-sm">{taskType?.name || type}</span>
                      </div>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  )
                })
            ) : (
              <div className="text-center py-3 text-muted-foreground text-sm">
                No tasks have been created yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Upcoming Tasks */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Upcoming Tasks</h4>
          <div className="space-y-3">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map(task => {
                const taskType = TASK_TYPES.find(t => t.id === task.type)
                return (
                  <div key={task.id} className="flex items-start space-x-3 border-b border-border/30 last:border-0 pb-3 last:pb-0">
                    <div className={`h-6 w-6 rounded-full mt-1 flex items-center justify-center ${
                      task.type === "email" ? "bg-blue-100 text-blue-600" :
                      task.type === "call" ? "bg-green-100 text-green-600" :
                      task.type === "meeting" ? "bg-purple-100 text-purple-600" :
                      task.type === "demo" ? "bg-yellow-100 text-yellow-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {task.type === "email" ? (
                        <Mail className="h-3 w-3" />
                      ) : task.type === "call" ? (
                        <Phone className="h-3 w-3" />
                      ) : task.type === "meeting" ? (
                        <Users className="h-3 w-3" />
                      ) : task.type === "contract" || task.type === "quote" || task.type === "payment" ? (
                        <Tag className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h5 className="text-sm font-medium truncate">{task.title}</h5>
                        <Badge variant={task.status === 'completed' ? 'outline' : 'secondary'} className="ml-2">
                          {task.status === 'completed' ? 'Done' : task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{taskType?.name || task.type}</p>
                      {task.scheduled_date && (
                        <p className="text-xs mt-1 flex items-center">
                          <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {new Date(task.scheduled_date).toLocaleDateString('en-US', { 
                              month: 'short', day: 'numeric', year: '2-digit'
                            })}
                            {' '}({formatDistanceToNow(new Date(task.scheduled_date), { addSuffix: true })})
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-3 text-muted-foreground text-sm">
                No upcoming tasks
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Total Value */}
      {totalValue > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-2">Total Opportunity Value</h4>
            <p className="text-2xl font-bold">
              ${totalValue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Combined value of quotes, contracts, and payments
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* NPS Score */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Customer Satisfaction</h4>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">0</span>
              <span className="text-xs text-muted-foreground">10</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full mb-2">
              <div className="h-2 bg-primary rounded-full" style={{ width: `${npsScore * 10}%` }}></div>
            </div>
            <NPSIndicator score={npsScore} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold">{npsScore}/10</p>
              <p className="text-xs text-muted-foreground">Customer score</p>
            </div>
            <Badge className={`${npsInfo.bgColor} ${npsInfo.textColor} border-0`}>
              {npsInfo.category}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function JourneySummary({ leadId }: JourneySummaryProps) {
  return (
    <TasksProvider leadId={leadId}>
      <JourneySummaryContent leadId={leadId} />
    </TasksProvider>
  )
} 