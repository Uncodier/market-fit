"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Deal, DEAL_STATUSES } from "@/app/deals/types"
import { getDealById, updateDeal } from "@/app/deals/actions"
import { getTasksByDealId } from "@/app/tasks/actions"
import { TaskList } from "@/app/control-center/components/TaskList"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { DealDetail } from "@/app/deals/components/DealDetail"
import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ClipboardList } from "@/app/components/ui/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

// Deal status component
interface DealStatusBarProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

const DEAL_STATUS_STYLES = {
  open: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
  won: "bg-green-100 text-green-800 hover:bg-green-200 border-green-200",
  lost: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200"
};

function DealStatusBar({ currentStatus, onStatusChange }: DealStatusBarProps) {
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  
  const handleStatusClick = (status: string) => {
    if ((status === "won" || status === "lost") && currentStatus !== status) {
      setPendingStatus(status);
      setShowCompletionDialog(true);
    } else {
      onStatusChange(status);
    }
  };
  
  const handleConfirmStatus = () => {
    if (pendingStatus) {
      onStatusChange(pendingStatus);
      setPendingStatus(null);
    }
    setShowCompletionDialog(false);
  };
  
  return (
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
        {DEAL_STATUSES.map((status) => (
          <Badge 
            key={status.id} 
            className={`px-3 py-1 text-sm cursor-pointer whitespace-nowrap transition-colors duration-200 shrink-0 ${
              currentStatus === status.id 
                ? DEAL_STATUS_STYLES[status.id as keyof typeof DEAL_STATUS_STYLES] || 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => handleStatusClick(status.id)}
          >
            {status.name}
          </Badge>
        ))}
      </div>
      
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark deal as {pendingStatus}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this deal as {pendingStatus}? This will update the deal metrics and pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmStatus}
              className={pendingStatus === "won" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DealPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("summary")

  const id = params.id as string
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    async function loadDeal() {
      if (!id) return
      
      setLoading(true)
      try {
        const result = await getDealById(id)
        if (result.error) {
          toast.error(result.error)
          router.push("/deals")
          return
        }
        
        if (result.deal) {
          setDeal(result.deal)
          
          // Load tasks in parallel (non-blocking)
          getTasksByDealId(id).then(tasksResult => {
            if (tasksResult.data) {
              setTasks(tasksResult.data)
            }
          }).catch(e => console.error("Failed to load tasks:", e))

          // Update breadcrumb
          const event = new CustomEvent('breadcrumb:update', {
            detail: {
              title: result.deal.name,
              path: `/deals/${id}`,
              section: 'deals'
            }
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.error("Error loading deal:", error)
        toast.error("Error loading deal")
      } finally {
        setLoading(false)
      }
    }

    loadDeal()
    
    // Cleanup breadcrumb on unmount
    return () => {
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'deals'
        }
      });
      window.dispatchEvent(resetEvent);
    };
  }, [id, router])

  const handleStatusChange = async (newStatus: string) => {
    if (!deal) return;
    
    try {
      const result = await updateDeal({ id: deal.id, status: newStatus as Deal["status"] })
      if (result.error) {
        toast.error(result.error)
      } else if (result.deal) {
        toast.success(`Status updated to ${newStatus}`)
        setDeal(result.deal)
      }
    } catch (e) {
      toast.error("Failed to update status")
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-0">
        <StickyHeader>
          <div className="flex items-center justify-between px-4 md:px-16 w-full">
            <Skeleton className="h-10 w-64 mb-2" />
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-4 md:px-16 space-y-6">
              <Skeleton className="h-[400px] w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Deal not found</h2>
          <Button onClick={() => router.push("/deals")}>Back to Deals</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 md:px-16 w-full gap-4 sm:gap-0">
            <TabsList className="w-full sm:w-auto justify-start overflow-x-auto hide-scrollbar">
              <TabsTrigger value="summary">Deal Summary</TabsTrigger>
              <TabsTrigger value="details">Details & Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar w-full sm:w-auto justify-start sm:justify-end">
              {deal && (
                <DealStatusBar 
                  currentStatus={deal.status}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </div>
        </StickyHeader>
        
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-0 sm:px-4 md:px-16">
              <TabsContent value="summary" className="mt-0 p-0">
                <DealDetail deal={deal} onUpdate={(updatedDeal) => setDeal(updatedDeal)} tab="summary" onTabChange={setActiveTab} />
              </TabsContent>
              <TabsContent value="details" className="mt-0 p-0">
                <DealDetail deal={deal} onUpdate={(updatedDeal) => setDeal(updatedDeal)} tab="details" onTabChange={setActiveTab} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0 p-0">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Deal Tasks</h3>
                  {tasks.length > 0 ? (
                    <TaskList tasks={tasks} maxHeight="none" />
                  ) : (
                    <EmptyCard
                      variant="fancy"
                      icon={<ClipboardList />}
                      title="No tasks found for this deal"
                      description="Create tasks to track your activities and progress for this deal."
                      className="min-h-[400px] border rounded-lg bg-muted/5"
                    />
                  )}
                </div>
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
