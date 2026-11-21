import { notFound } from "next/navigation"
import { getCommandById } from "@/app/agents/actions"
import type { Command } from "@/app/agents/types"
import { Alert } from "@/app/components/ui/alert"
import CommandDetail from "./command-detail"
import { createClient } from "@/lib/supabase/server"

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

export default async function CommandDetailPage(props: { params: Promise<{ id: string; commandId: string }> }) {
  const { id: agentId, commandId } = await props.params
  const { command, error } = await getCommandById(commandId)
  if (error && error !== "Command not found") {
    return (
      <div className="px-4 py-6 md:px-16">
        <Alert variant="destructive">Unable to load this command. Refresh the page to try again.</Alert>
      </div>
    )
  }
  if (!command) notFound()

  const agentName = await resolveAgentName(command.agent_id || agentId)
  return <CommandDetail command={command as Command} commandId={commandId} agentName={agentName || "Unknown Agent"} />
}