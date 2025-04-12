"use server"

import { getCommandById } from "@/app/agents/actions"
import { Command } from "@/app/agents/types"
import CommandDetail from "./command-detail"

export default async function CommandDetailPage({ params }: { params: { id: string } }) {
  const commandId = params.id
  let commandData = null
  
  // Intentar cargar los datos del comando
  try {
    const response = await getCommandById(commandId)
    commandData = response.command
  } catch (error) {
    console.error('Error loading command:', error)
  }
  
  return (
    <CommandDetail command={commandData} commandId={commandId} />
  )
} 