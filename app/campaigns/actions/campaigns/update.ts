"use server"

import { createClient } from "@/lib/supabase/server"
import { transformCampaignData, isValidUUID } from "../utils/transformers"
import { type CampaignFormValues } from "../../schema"

// Update campaign
export async function updateCampaign(id: string, values: Partial<CampaignFormValues>) {
  try {
    console.log("[updateCampaign] Starting update with values:", JSON.stringify(values));
    const supabase = await createClient()

    // Extract segments to handle them separately
    const segments = values.segments;
    
    // Remove segments from the data to be updated directly on the campaign
    const valuesToUpdate = { ...values };
    delete valuesToUpdate.segments;
    delete valuesToUpdate.segmentObjects; // This is just for UI display

    // Prepare campaign data
    const campaignData = {
      ...(valuesToUpdate.title && { title: valuesToUpdate.title }),
      ...(valuesToUpdate.description !== undefined && { description: valuesToUpdate.description }),
      ...(valuesToUpdate.priority && { priority: valuesToUpdate.priority }),
      ...(valuesToUpdate.dueDate && { due_date: valuesToUpdate.dueDate }),
      ...(valuesToUpdate.type && { type: valuesToUpdate.type }),
      ...(valuesToUpdate.budget && { budget: valuesToUpdate.budget }),
      ...(valuesToUpdate.revenue && { revenue: valuesToUpdate.revenue })
    }

    console.log("[updateCampaign] Prepared campaign data:", JSON.stringify(campaignData));

    // Update campaign
    const { data, error } = await supabase
      .from("campaigns")
      .update(campaignData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[updateCampaign] Error updating campaign data:", error);
      throw new Error(`Error updating campaign: ${error.message}`)
    }

    console.log("[updateCampaign] Campaign updated successfully:", JSON.stringify(data));

    // Initialize a transform of the data
    const transformedData = transformCampaignData(data);
    
    // After successful campaign update, handle segments if provided
    if (segments !== undefined) {
      // Store the segments for later return
      transformedData.segments = segments;
      
      console.log("[updateCampaign] Handling segments:", JSON.stringify(segments));
      console.log("[updateCampaign] Segment data type:", typeof segments, Array.isArray(segments));
      
      // First get existing segment relations to know what we're working with
      const { data: existingRelations, error: fetchError } = await supabase
        .from("campaign_segments")
        .select("*")
        .eq("campaign_id", id);
        
      if (fetchError) {
        console.error("[updateCampaign] Error fetching existing segment relations:", fetchError);
      } else {
        console.log("[updateCampaign] Existing segment relations:", JSON.stringify(existingRelations));
      }
      
      // First delete existing relations
      const { error: deleteError } = await supabase
        .from("campaign_segments")
        .delete()
        .eq("campaign_id", id)
        
      if (deleteError) {
        console.error("[updateCampaign] Error deleting existing segments:", deleteError);
      } else {
        console.log("[updateCampaign] Successfully deleted existing segment relations");
      }

      // Insert new relations if segments provided
      if (segments.length > 0) {
        // Prepare segment relations for real segments only (valid UUIDs)
        const segmentRelations = segments
          .map(segmentId => {
            const normalizedId = String(segmentId).trim();
            
            // Check if this is a mock segment ID (starting with 's-') or not a valid UUID
            if (normalizedId.startsWith('s-') || !isValidUUID(normalizedId)) {
              console.log(`[updateCampaign] Skipping non-UUID segment ID: ${normalizedId}`);
              return null;
            }
            
            console.log(`[updateCampaign] Processing valid UUID segment ID: ${normalizedId}`);
            return {
              campaign_id: id,
              segment_id: normalizedId
            };
          })
          .filter(relation => relation !== null) as { campaign_id: string; segment_id: string }[];
        
        console.log(`[updateCampaign] Number of valid segment relations: ${segmentRelations.length}`);
        console.log("[updateCampaign] Valid segment relations:", JSON.stringify(segmentRelations));
        
        // Only proceed with insertion if we have valid relations
        if (segmentRelations.length > 0) {
          try {
            // Insert all valid segment relations at once
            const { data: bulkData, error: bulkError } = await supabase
              .from("campaign_segments")
              .insert(segmentRelations)
              .select();
              
            if (bulkError) {
              console.error("[updateCampaign] Error with bulk segment insertion:", bulkError);
              
              // If bulk insert fails, try one by one
              console.log("[updateCampaign] Trying individual segment insertions...");
              
              for (const relation of segmentRelations) {
                const { data: singleData, error: singleError } = await supabase
                  .from("campaign_segments")
                  .insert([relation]);
                  
                if (singleError) {
                  console.error(`[updateCampaign] Error inserting segment ${relation.segment_id}:`, singleError);
                } else {
                  console.log(`[updateCampaign] Successfully inserted segment ${relation.segment_id}`);
                }
              }
            } else {
              console.log("[updateCampaign] Successfully inserted all segments:", JSON.stringify(bulkData));
            }
          } catch (error) {
            console.error("[updateCampaign] Exception during segment insertion:", error);
          }
        } else {
          console.log("[updateCampaign] No valid UUID segments to insert");
        }
        
        // Add mock segments to the transformedData for UI purposes
        const mockSegments = segments.filter(segmentId => {
          const normalizedId = String(segmentId).trim();
          return normalizedId.startsWith('s-') || !isValidUUID(normalizedId);
        });
        
        if (mockSegments.length > 0) {
          console.log(`[updateCampaign] Adding ${mockSegments.length} mock segments to response:`, JSON.stringify(mockSegments));
          
          // Ensure we return all segments (including mocks) in the response
          transformedData.segments = segments;
        }
      } else {
        console.log("[updateCampaign] No segments to insert");
      }
    } else {
      console.log("[updateCampaign] No segments to update (undefined)");
    }

    // Update requirements if provided
    if (values.requirements) {
      console.log("[updateCampaign] Updating requirements:", JSON.stringify(values.requirements));
      
      // First delete existing relations
      const { error: deleteReqError } = await supabase
        .from("campaign_requirements")
        .delete()
        .eq("campaign_id", id)
        
      if (deleteReqError) {
        console.error("[updateCampaign] Error deleting existing requirements:", deleteReqError);
      }

      // Insert new relations
      if (values.requirements.length > 0) {
        const requirementRelations = values.requirements.map(requirementId => ({
          campaign_id: id,
          requirement_id: requirementId
        }))

        const { error: requirementError } = await supabase
          .from("campaign_requirements")
          .insert(requirementRelations)

        if (requirementError) {
          console.error("[updateCampaign] Error updating requirements:", requirementError)
        } else {
          console.log("[updateCampaign] Successfully updated requirements");
        }
      }
    }

    // Get updated segment relations after all operations
    try {
      const { data: finalRelations, error: finalError } = await supabase
        .from("campaign_segments")
        .select("segment_id")
        .eq("campaign_id", id);
        
      if (finalError) {
        console.error("[updateCampaign] Error fetching final segment relations:", finalError);
      } else {
        const finalSegmentIds = finalRelations.map(r => r.segment_id);
        console.log("[updateCampaign] Final segment relations in database:", JSON.stringify(finalSegmentIds));
      }
    } catch (err) {
      console.error("[updateCampaign] Error checking final segment state:", err);
    }

    console.log("[updateCampaign] Final transformed data:", JSON.stringify(transformedData));
    return { data: transformedData, error: null }
  } catch (error) {
    console.error("Error in updateCampaign:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 