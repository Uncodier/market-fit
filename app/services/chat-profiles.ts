import { supabase } from "./chat-runtime"
import type { Agent } from "@/app/types/agents"
import { readVisibleProfile } from './read-visible-profile'

export async function getUserData(userId: string): Promise<{ name: string, avatar_url: string | null } | null> {
  return readVisibleProfile(supabase, userId)
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
