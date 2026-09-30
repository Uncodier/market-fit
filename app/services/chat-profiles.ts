import { supabase } from "./chat-runtime"
import type { Agent } from "@/app/types/agents"

// Cache for user data to avoid redundant fetches
export const userCache: Record<string, { name: string, avatar_url: string | null }> = {};

/**
 * Fetch user data by user ID
 */
export async function getUserData(userId: string): Promise<{ name: string, avatar_url: string | null } | null> {
  // Check cache first
  if (userCache[userId]) {
    return userCache[userId];
  }

  try {
    // First try to get the user from the profiles table (created by a trigger in Supabase)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, avatar_url")
      .eq("id", userId)
      .single();

    if (!profileError && profile) {
      // Cache the user data from profiles
      const userData = {
        name: profile.name || (profile.email ? profile.email.split('@')[0] : 'Team Member'),
        avatar_url: profile.avatar_url
      };
      
      userCache[userId] = userData;
      return userData;
    }

    // If profile not found, try to get auth user data directly
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(userId);
      
      if (!authError && authUser) {
        const userData = {
          name: authUser.user_metadata?.name || 
                authUser.user_metadata?.full_name || 
                (authUser.email ? authUser.email.split('@')[0] : 'Team Member'),
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null
        };
        
        userCache[userId] = userData;
        return userData;
      }
    } catch (authError) {
      console.error("Error getting auth user data:", authError);
    }
    
    // If we still don't have user data, return a fallback with truncated ID
    console.log("Could not find user data for user ID:", userId);
    const fallbackData = {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    };
    
    // Still cache this fallback to avoid repeated lookups
    userCache[userId] = fallbackData;
    return fallbackData;
  } catch (error) {
    console.error("Unexpected error fetching user data:", error);
    return {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    };
  }
}

/**
 * Get agent details for a conversation
 */
export async function getAgentForConversation(agentId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single()

  if (error) {
    console.error("Error fetching agent:", error)
    return null
  }

  // Convert to Agent type
  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    type: data.type,
    status: data.status,
    conversations: data.conversations,
    successRate: data.success_rate,
    lastActive: data.last_active || new Date().toISOString(),
    icon: data.icon || getRoleBasedIcon(data.role, data.type), // Usar el icono de la DB o determinar uno basado en el rol/tipo
    role: data.role || undefined,
    tools: data.tools || {},
    activities: data.activities || {},
    integrations: data.integrations || {},
    supervisor: data.supervisor || undefined
  }
}

/**
 * Determina un icono apropiado basado en el rol o tipo del agente
 */
export function getRoleBasedIcon(role?: string | null, type?: string): string {
  // Si hay un rol, intentar determinar el icono basado en él
  if (role) {
    const roleLower = role.toLowerCase();
    
    if (roleLower.includes("growth") && roleLower.includes("lead")) {
      return "BarChart";
    } else if (roleLower.includes("growth") && roleLower.includes("market")) {
      return "TrendingUp";
    } else if (roleLower.includes("data") && roleLower.includes("analyst")) {
      return "PieChart";
    } else if (roleLower.includes("ux") || roleLower.includes("designer")) {
      return "Smartphone";
    } else if (roleLower.includes("sales") || roleLower.includes("crm")) {
      return "ShoppingCart";
    } else if (roleLower.includes("support") || roleLower.includes("customer")) {
      return "HelpCircle";
    } else if (roleLower.includes("content") || roleLower.includes("copywriter")) {
      return "FileText";
    }
  }
  
  // Si no hay rol o no se pudo determinar, usar el tipo
  if (type) {
    switch (type.toLowerCase()) {
      case "marketing":
        return "TrendingUp";
      case "sales":
        return "ShoppingCart";
      case "support":
        return "HelpCircle";
      case "product":
        return "Smartphone";
    }
  }
  
  // Fallback predeterminado
  return "User";
}
