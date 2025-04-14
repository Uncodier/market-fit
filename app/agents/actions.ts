"use server"

import { createClient } from "@/utils/supabase/server"
import { z } from "zod"
import { Command, CommandsResponse } from "./types"

// Define response schema
const CommandSchema = z.object({
  commands: z.array(z.object({
    id: z.string(),
    task: z.string(),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
    user_id: z.string(),
    site_id: z.string(),
    description: z.string().nullable(),
    results: z.any().nullable(),
    targets: z.any().nullable(),
    tools: z.any().nullable(),
    context: z.string().nullable(),
    supervisor: z.any().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    completion_date: z.string().nullable(),
    duration: z.number().nullable(),
    model: z.string().nullable(),
    agent_id: z.string().nullable(),
    output_tokens: z.number().nullable(),
    input_tokens: z.number().nullable()
  })).nullable(),
  error: z.string().optional()
})

export type CommandResponse = z.infer<typeof CommandSchema>

// Schema for single command response
const SingleCommandSchema = z.object({
  command: z.object({
    id: z.string(),
    task: z.string(),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
    user_id: z.string(),
    site_id: z.string(),
    description: z.string().nullable(),
    results: z.any().nullable(),
    targets: z.any().nullable(),
    tools: z.any().nullable(),
    context: z.string().nullable(),
    supervisor: z.any().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    completion_date: z.string().nullable(),
    duration: z.number().nullable(),
    model: z.string().nullable(),
    agent_id: z.string().nullable(),
    output_tokens: z.number().nullable(),
    input_tokens: z.number().nullable()
  }).nullable(),
  error: z.string().optional()
})

export type SingleCommandResponse = z.infer<typeof SingleCommandSchema>

export async function getCommands(site_id: string): Promise<CommandsResponse> {
  try {
    const supabase = await createClient()
    
    console.log("Iniciando consulta a Supabase en getCommands() para site_id:", site_id)
    
    // First, get agent IDs for this site
    const { data: agentData, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq('site_id', site_id)
    
    if (agentError) {
      console.error("Error fetching agents for site:", agentError)
      throw agentError
    }
    
    // Extract agent IDs
    const agentIds = agentData?.map(agent => agent.id) || []
    
    // If no agents found for this site, return empty array
    if (agentIds.length === 0) {
      console.log(`No agents found for site_id ${site_id}, returning empty commands array`)
      return { commands: [] }
    }
    
    // Get commands for these agents
    const { data, error } = await supabase
      .from("commands")
      .select(`
        id,
        task,
        status,
        user_id,
        description,
        results,
        targets,
        tools,
        context,
        supervisor,
        created_at,
        updated_at,
        completion_date,
        duration,
        model,
        agent_id,
        output_tokens,
        input_tokens
      `)
      .in('agent_id', agentIds)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error en la consulta de Supabase:", error)
      throw error
    }

    console.log(`Datos recibidos de Supabase: ${data?.length || 0} registros para agents de site_id ${site_id}`)
    
    // Si no hay datos, retornamos un array vacío en lugar de null
    return { commands: data || [] }
  } catch (error) {
    console.error("Error loading commands:", error)
    return { commands: [], error: "Error loading commands" }
  }
}

export async function getCommandById(id: string): Promise<SingleCommandResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("commands")
      .select(`
        id,
        task,
        status,
        user_id,
        site_id,
        description,
        results,
        targets,
        tools,
        context,
        supervisor,
        created_at,
        updated_at,
        completion_date,
        duration,
        model,
        agent_id,
        output_tokens,
        input_tokens
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { error: "Command not found", command: null }
      }
      throw error
    }

    return { command: data }
  } catch (error) {
    console.error("Error loading command:", error)
    return { error: "Error loading command", command: null }
  }
}

// Define the Agent response schema
const AgentSchema = z.object({
  agent: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    type: z.enum(["sales", "support", "marketing", "product"]),
    status: z.enum(["active", "inactive", "learning", "error"]),
    role: z.string().nullable(),
    tools: z.record(z.any()).nullable(),
    activities: z.union([z.record(z.any()), z.array(z.any())]).nullable(),
    integrations: z.record(z.any()).nullable(),
    supervisor: z.string().nullable(),
    files: z.array(z.string()).nullable(),
    configuration: z.any().nullable(),
    conversations: z.number().nullable(),
    success_rate: z.number().nullable(),
    last_active: z.string().nullable(),
    user_id: z.string().nullable(),
    site_id: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable()
  }).nullable(),
  error: z.string().optional()
})

export type AgentResponse = z.infer<typeof AgentSchema>

export async function getAgentById(id: string): Promise<AgentResponse> {
  try {
    console.log("getAgentById called with id:", id);
    
    if (!id) {
      console.log("getAgentById received empty id");
      return { error: "Agent ID not provided", agent: null };
    }
    
    const supabase = await createClient()
    
    // Check if agentId is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isValidUUID) {
      console.log("Querying agent with UUID:", id);
      const { data, error } = await supabase
        .from("agents")
        .select(`
          id,
          name,
          description,
          type,
          status,
          role,
          tools,
          activities,
          integrations,
          supervisor,
          files,
          configuration,
          conversations,
          success_rate,
          last_active,
          user_id,
          site_id,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.log("Error in getAgentById with UUID:", error.code, error.message);
        if (error.code === 'PGRST116') {
          return { error: "Agent not found", agent: null }
        }
        throw error;
      }

      console.log("Agent data retrieved by UUID:", data ? { id: data.id, name: data.name } : "No data");
      return { agent: data };
    } else {
      // If not a UUID, try to find by role
      console.log("Trying to find agent by role:", id);
      const { data, error } = await supabase
        .from("agents")
        .select(`
          id,
          name,
          description,
          type,
          status,
          role,
          tools,
          activities,
          integrations,
          supervisor,
          files,
          configuration,
          conversations,
          success_rate,
          last_active,
          user_id,
          site_id,
          created_at,
          updated_at
        `)
        .eq('role', id)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.log("Error in getAgentById with role:", error.code, error.message);
        throw error;
      }

      if (data) {
        console.log("Agent data retrieved by role:", { id: data.id, name: data.name });
        return { agent: data };
      }
      
      // If we can't find by role, create a synthetic agent with the ID as the name
      console.log("Creating synthetic agent for:", id);
      return { 
        agent: {
          id: id,
          name: id, // Use the ID as the name
          description: null,
          type: "support",
          status: "active",
          role: id,
          tools: null,
          activities: null,
          integrations: null,
          supervisor: null,
          files: null,
          configuration: null,
          conversations: 0,
          success_rate: 0,
          last_active: new Date().toISOString(),
          user_id: null,
          site_id: null,
          created_at: null,
          updated_at: null
        } 
      };
    }
  } catch (error) {
    console.error("Error loading agent:", error);
    // Create a fallback agent with the ID as the name
    return { 
      error: "Error loading agent", 
      agent: {
        id: id,
        name: id,
        description: null,
        type: "support",
        status: "active",
        role: null,
        tools: null,
        activities: null,
        integrations: null,
        supervisor: null,
        files: null,
        configuration: null,
        conversations: 0,
        success_rate: 0,
        last_active: new Date().toISOString(),
        user_id: null,
        site_id: null,
        created_at: null,
        updated_at: null
      }
    };
  }
} 