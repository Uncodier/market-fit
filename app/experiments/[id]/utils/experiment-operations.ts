import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Experiment } from "../types"

export interface SegmentChange {
  pendingSegments: Array<{id: string, name: string, participants: number}>;
  removedSegmentIds: string[];
}

/**
 * Simplified function to handle experiment segment changes with RLS-friendly approach
 */
export async function handleExperimentSegmentChanges(
  experiment: Experiment,
  pendingSegmentChanges: SegmentChange | null
): Promise<{ success: boolean; error?: string }> {
  if (!pendingSegmentChanges) {
    return { success: true };
  }

  console.log("Processing segment changes:", pendingSegmentChanges);
  const supabase = createClient();

  try {
    // 1. Remove segments that were deleted
    if (pendingSegmentChanges.removedSegmentIds.length > 0) {
      console.log("Removing segments:", pendingSegmentChanges.removedSegmentIds);
      
      const { error: removeError } = await supabase
        .from('experiment_segments')
        .delete()
        .eq('experiment_id', experiment.id)
        .in('segment_id', pendingSegmentChanges.removedSegmentIds);
        
      if (removeError) {
        console.error("Error removing segments:", removeError);
        return { 
          success: false, 
          error: `Failed to remove segments: ${removeError.message}` 
        };
      }
    }
    
    // 2. Add new segments (trust RLS policies for access control)
    const existingSegmentIds = experiment.segments.map(s => s.id);
    const newSegments = pendingSegmentChanges.pendingSegments.filter(
      s => !existingSegmentIds.includes(s.id) && 
           !pendingSegmentChanges.removedSegmentIds.includes(s.id)
    );
    
    if (newSegments.length > 0) {
      console.log("Adding new segments:", newSegments);
      
      // Insert new experiment-segment relationships
      // The RLS policy will handle access control automatically
      const insertData = newSegments.map(segment => ({
        experiment_id: experiment.id,
        segment_id: segment.id,
        participants: segment.participants || 0
      }));

      const { error: addError } = await supabase
        .from('experiment_segments')
        .insert(insertData);
        
      if (addError) {
        console.error("Error adding segments:", addError);
        
        // Handle RLS policy violations with user-friendly messages
        if (addError.message.includes('row-level security policy')) {
          return { 
            success: false, 
            error: "You don't have permission to add these segments to this experiment" 
          };
        }
        
        return { 
          success: false, 
          error: `Failed to add segments: ${addError.message}` 
        };
      }
    }

    return { success: true };

  } catch (error) {
    console.error("Unexpected error in segment changes:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    };
  }
}

/**
 * Load experiment with all related data
 */
export async function loadExperimentWithSegments(experimentId: string): Promise<{
  experiment?: Experiment;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { data: experimentData, error: experimentError } = await supabase
      .from('experiments')
      .select(`
        id,
        name,
        description,
        instructions,
        status,
        start_date,
        end_date,
        conversion,
        roi,
        preview_url,
        hypothesis,
        campaign_id,
        site_id,
        experiment_segments (
          segment_id,
          participants,
          segments (
            id,
            name
          )
        ),
        validations
      `)
      .eq('id', experimentId)
      .maybeSingle();

    if (experimentError) {
      console.error("Error loading experiment:", experimentError);
      return { error: experimentError.message };
    }

    if (!experimentData) {
      return { error: "Experiment not found" };
    }

    // Transform the data to match our Experiment interface
    const experiment: Experiment = {
      ...experimentData,
      campaign: null, // Will be loaded separately if needed
      segments: experimentData.experiment_segments?.map((es: any) => ({
        id: es.segments.id,
        name: es.segments.name,
        participants: es.participants || 0
      })) || []
    };

    return { experiment };

  } catch (error) {
    console.error("Unexpected error loading experiment:", error);
    return { 
      error: error instanceof Error ? error.message : "Failed to load experiment" 
    };
  }
}

/**
 * Update experiment with optimized error handling
 */
export async function updateExperimentData(
  experimentId: string,
  updates: Partial<Experiment>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('experiments')
      .update(updates)
      .eq('id', experimentId);

    if (error) {
      console.error("Error updating experiment:", error);
      return { 
        success: false, 
        error: `Failed to update experiment: ${error.message}` 
      };
    }

    return { success: true };

  } catch (error) {
    console.error("Unexpected error updating experiment:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update experiment" 
    };
  }
} 