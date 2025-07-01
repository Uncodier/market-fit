import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { startExperiment, stopExperiment, setExperimentStatus } from "../../actions"
import { Experiment } from "../types"

/**
 * Handle experiment status changes
 */
export async function handleExperimentStatusChange(
  experiment: Experiment,
  newStatus: "draft" | "active" | "completed",
  setIsActionLoading: (loading: boolean) => void,
  setExperiment: (updater: (prev: Experiment | null) => Experiment | null) => void
): Promise<void> {
  if (experiment.status === newStatus) return;
  
  setIsActionLoading(true);
  try {
    let result;
    
    // Use existing specialized functions for active and completed
    if (newStatus === "active") {
      result = await startExperiment(experiment.id);
    } else if (newStatus === "completed") {
      result = await stopExperiment(experiment.id);
    } else {
      // For draft status, use the new generic function
      result = await setExperimentStatus(experiment.id, newStatus);
    }
    
    if (result.error) {
      toast.error(result.error);
      return;
    }

    // Update local state
    setExperiment(prev => 
      prev ? { 
        ...prev, 
        status: newStatus,
        // Update dates accordingly
        start_date: newStatus === "active" ? new Date().toISOString() : prev.start_date,
        end_date: newStatus === "completed" ? new Date().toISOString() : prev.end_date
      } : null
    );

    toast.success(`Experiment ${newStatus === "draft" ? "set to draft" : newStatus === "active" ? "started" : "completed"} successfully`);
  } catch (error) {
    toast.error("An unexpected error occurred while updating experiment status");
  } finally {
    setIsActionLoading(false);
  }
}

/**
 * Handle experiment deletion
 */
export async function handleExperimentDeletion(
  experiment: Experiment,
  currentSiteId: string,
  router: { push: (path: string) => void }
): Promise<void> {
  try {
    // Delete experiment from Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', experiment.id)
      .eq('site_id', currentSiteId)

    if (error) {
      console.error("Error deleting experiment:", error)
      toast.error("Failed to delete experiment")
      return
    }

    // Navigate back to experiments list
    router.push('/experiments')
    toast.success("Experiment deleted successfully")
  } catch (error) {
    console.error("Error deleting experiment:", error)
    toast.error("An unexpected error occurred")
  }
}

/**
 * Start an experiment
 */
export async function handleStartExperiment(
  experimentId: string,
  setIsActionLoading: (loading: boolean) => void,
  setExperiment: (updater: (prev: Experiment | null) => Experiment | null) => void
): Promise<void> {
  try {
    setIsActionLoading(true)
    const result = await startExperiment(experimentId)
    
    if (result.error) {
      toast.error(result.error)
      return
    }

    // Update local state
    setExperiment(prev => 
      prev ? { 
        ...prev, 
        status: "active", 
        start_date: new Date().toISOString() 
      } : null
    )

    toast.success("Experiment started successfully")
  } catch (error) {
    toast.error("An unexpected error occurred")
  } finally {
    setIsActionLoading(false)
  }
}

/**
 * Stop an experiment
 */
export async function handleStopExperiment(
  experimentId: string,
  setIsActionLoading: (loading: boolean) => void,
  setExperiment: (updater: (prev: Experiment | null) => Experiment | null) => void
): Promise<void> {
  try {
    setIsActionLoading(true)
    const result = await stopExperiment(experimentId)
    
    if (result.error) {
      toast.error(result.error)
      return
    }

    // Update local state
    setExperiment(prev => 
      prev ? { 
        ...prev, 
        status: "completed", 
        end_date: new Date().toISOString() 
      } : null
    )

    toast.success("Experiment stopped successfully")
  } catch (error) {
    toast.error("An unexpected error occurred")
  } finally {
    setIsActionLoading(false)
  }
} 