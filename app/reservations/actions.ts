"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Reservation } from "@/app/types";

export async function getReservations(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        catalog_item:catalog_items(id, name, description, kind, parent_id, metadata, parent:parent_id(name)),
        location:locations(id, name),
        lead:leads(id, name, email, phone)
      `)
      .eq("site_id", siteId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching reservations:", error);
      return { data: [], error: error.message };
    }

    const buyerIds = Array.from(
      new Set((data || []).map((r) => r.buyer_user_id).filter(Boolean))
    ) as string[]

    let profileById = new Map<string, { id: string; name?: string | null; avatar_url?: string | null }>()
    if (buyerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", buyerIds)
      profileById = new Map((profiles || []).map((p) => [p.id, p]))
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        *,
        lead:leads(id, name, email, phone)
      `)
      .eq("site_id", siteId)
      .not("scheduled_date", "is", null);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
    }

    const mappedTasks: Reservation[] = (tasks || [])
      .filter((task) => !!task.assignee) // Remove strict type filter, show all assigned tasks as before per your request
      .map((task) => {
      const startTime = new Date(task.scheduled_date);
      let endTime = (task as any).end_date ? new Date((task as any).end_date) : new Date(startTime.getTime() + 60 * 60 * 1000); // default 1 hour later
      let parsedNotes = task.description || "";
      let catalogItemName = task.title || "Team Task";
      
      let contextData = task.metadata?._calendar_context;
      
      // Fallback for legacy data that had calendar_context in description
      if (!contextData) {
        try {
          const notesData = JSON.parse(task.description || "{}");
          if (notesData._calendar_context) {
            contextData = notesData._calendar_context;
            parsedNotes = notesData.notes || "";
          }
        } catch (e) {
          // Not JSON, ignore
        }
      } else {
        // Even if contextData exists, description might still contain the legacy JSON string 
        // because previous updates didn't clear it. Let's clean it up if so.
        try {
          const notesData = JSON.parse(task.description || "{}");
          if (notesData._calendar_context) {
            parsedNotes = notesData.notes || "";
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }

      if (contextData) {
        catalogItemName = `${task.title} (${contextData.catalog_item_name})`;
        
        if (contextData.location) {
           parsedNotes = parsedNotes ? `${parsedNotes}\n\nLocation: ${contextData.location}` : `Location: ${contextData.location}`;
        }

        if (!(task as any).end_date) {
          // Use ISO end_time from context if available
          if (contextData.end_time) {
            endTime = new Date(contextData.end_time);
          } else {
             // fallback: attempt to parse duration (e.g. "60 min", "2 hours")
            const durationStr = contextData.duration;
            if (durationStr) {
              const minMatch = durationStr.match(/(\d+)\s*min/i);
              const hrMatch = durationStr.match(/(\d+)\s*hour/i);
              if (minMatch) {
                endTime = new Date(startTime.getTime() + parseInt(minMatch[1]) * 60 * 1000);
              } else if (hrMatch) {
                endTime = new Date(startTime.getTime() + parseInt(hrMatch[1]) * 60 * 60 * 1000);
              }
            }
          }
        }
      }

      return {
        id: `task_${task.id}`,
        site_id: task.site_id,
        lead_id: task.lead_id || "",
        assignee_user_id: task.assignee || task.user_id,
        status: task.status === "completed" ? "completed" : task.status === "in_progress" ? "confirmed" : "pending",
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: parsedNotes,
        created_at: task.created_at,
        updated_at: task.updated_at,
        is_task: true,
        original_task_id: task.id,
        original_task_type: task.type,
        original_task_title: task.title,
        original_task_description: task.description,
        original_task_metadata: task.metadata,
        original_schedule_id: (task as any).schedule_id,
        catalog_item: {
          id: `task_${task.id}`,
          name: catalogItemName,
          kind: "service",
        },
        lead: task.lead,
        buyer_profile: null,
      } as Reservation;
    });

    const enriched = (data || []).map((row) => ({
      ...row,
      buyer_profile: row.buyer_user_id ? profileById.get(row.buyer_user_id) || null : null,
    })) as Reservation[];

    const combined = [...enriched, ...mappedTasks].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    return { data: combined };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function upsertReservation(reservation: Partial<Reservation>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .upsert({
        ...reservation,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/reservations");
    return { data: data as Reservation };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateReservationStatus(siteId: string, reservationId: string, status: Reservation['status']) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reservationId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/reservations");
    return { data: data as Reservation };
  } catch (error: any) {
    return { error: error.message };
  }
}
