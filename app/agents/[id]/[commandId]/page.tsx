"use server"

import { getCommandById } from "@/app/agents/actions"
import { Command } from "@/app/agents/types"
import CommandDetail from "./command-detail"
import { createClient } from "@/utils/supabase/server"
import { CommandDetailSkeleton } from "./command-detail-skeleton"

// Función específica para obtener el nombre del agente por ID
async function resolveAgentName(agentId: string): Promise<string> {
  if (!agentId) return "";
  
  try {
    const supabase = await createClient();
    
    // Intenta obtener el agente por ID
    const { data } = await supabase
      .from("agents")
      .select("name")
      .eq("id", agentId)
      .single();
    
    // Si encontramos el nombre, lo devolvemos
    if (data?.name) {
      return data.name;
    }
    
    // Si no encontramos por ID, intentamos buscar por rol
    const { data: roleData } = await supabase
      .from("agents")
      .select("name")
      .eq("role", agentId)
      .single();
    
    if (roleData?.name) {
      return roleData.name;
    }
    
    // Si no encontramos nada, devolvemos el ID original
    return agentId;
  } catch (error) {
    console.error("Error resolviendo nombre del agente:", error);
    // En caso de error, devolver el ID como fallback
    return agentId;
  }
}

export default async function CommandDetailPage({ params }: { params: { id: string; commandId: string } }) {
  const agentId = params.id
  const commandId = params.commandId
  let commandData = null
  let agentName = ""
  
  try {
    // Obtenemos el comando
    const response = await getCommandById(commandId)
    commandData = response.command as Command | null
    
    // Intentamos obtener el nombre del agente
    if (commandData?.agent_id) {
      // Usamos prioritariamente el agent_id del comando
      agentName = await resolveAgentName(commandData.agent_id);
    } else if (agentId) {
      // Si el comando no tiene agent_id, usamos el ID de la URL
      agentName = await resolveAgentName(agentId);
    }
  } catch (error) {
    console.error('Error loading command:', error)
  }
  
  // Asegurarnos de que siempre tenemos un nombre, usando el ID como fallback
  if (!agentName) {
    agentName = commandData?.agent_id || agentId || "Unknown Agent";
  }
  
  // Show skeleton while data is being fetched or if no data was found
  if (!commandData) {
    return <CommandDetailSkeleton />
  }
  
  return (
    <CommandDetail 
      command={commandData} 
      commandId={commandId} 
      agentName={agentName} 
    />
  )
} 