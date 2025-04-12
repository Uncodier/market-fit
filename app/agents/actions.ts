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

// Mock data for fallback in case of connection issues
const mockCommands: Command[] = [
  {
    id: "cmd1",
    task: "Analyze keyword trends for tech industry",
    description: "Generate a comprehensive analysis of trending keywords in the technology sector",
    status: "completed",
    user_id: "user123",
    created_at: "2024-10-31T15:45:00Z",
    updated_at: "2024-10-31T15:47:30Z",
    completion_date: "2024-10-31T15:47:30Z",
    duration: 150000,
    model: "gpt-4",
    output_tokens: 2450,
    input_tokens: 720,
    results: [
      { topic: "AI Solutions", score: 0.92, volume: 45000 },
      { topic: "Cloud Computing", score: 0.88, volume: 38000 },
      { topic: "Cybersecurity", score: 0.85, volume: 32000 }
    ],
    targets: [
      { type: "industry", id: "tech" },
      { type: "timeframe", id: "q4-2024" }
    ],
    tools: [
      { name: "keyword-analyzer", version: "2.1" },
      { name: "trend-tracker", version: "1.5" }
    ]
  },
  {
    id: "cmd2",
    task: "Generate content outline for blog post series",
    description: "Create a detailed outline for a 5-part blog series on digital marketing trends",
    status: "completed",
    user_id: "user123",
    created_at: "2024-10-30T11:20:00Z",
    updated_at: "2024-10-30T11:23:45Z",
    completion_date: "2024-10-30T11:23:45Z",
    duration: 225000,
    model: "gpt-4",
    output_tokens: 3200,
    input_tokens: 850,
    results: [
      {
        title: "Digital Marketing in 2025: The Complete Roadmap",
        parts: [
          "Part 1: AI-Driven Marketing Strategies",
          "Part 2: Social Commerce Evolution",
          "Part 3: Privacy-First Advertising",
          "Part 4: Metaverse Marketing Opportunities",
          "Part 5: Voice Search Optimization"
        ],
        wordCount: 7500
      }
    ],
    context: "Focus on emerging trends that will dominate digital marketing in the next 12 months"
  },
  {
    id: "cmd3",
    task: "Optimize product descriptions for e-commerce site",
    description: "Generate SEO-optimized product descriptions for 10 new products",
    status: "failed",
    user_id: "user123",
    created_at: "2024-10-29T09:15:00Z",
    updated_at: "2024-10-29T09:16:30Z",
    completion_date: "2024-10-29T09:16:30Z",
    duration: 90000,
    model: "gpt-4",
    context: "API error: Rate limit exceeded during processing",
    input_tokens: 1250,
    output_tokens: 0,
    targets: [
      { type: "product", id: "prod-001" },
      { type: "product", id: "prod-002" },
      { type: "product", id: "prod-003" },
      { type: "product", id: "prod-004" },
      { type: "product", id: "prod-005" }
    ]
  },
  {
    id: "cmd4",
    task: "Generate social media campaign ideas",
    description: "Create 20 engaging social media post ideas for product launch",
    status: "pending",
    user_id: "user123",
    created_at: "2024-11-01T08:30:00Z",
    updated_at: "2024-11-01T08:30:00Z",
    targets: [
      { type: "platform", id: "instagram" },
      { type: "platform", id: "tiktok" },
      { type: "platform", id: "linkedin" }
    ],
    tools: [
      { name: "content-generator", version: "3.0" },
      { name: "image-suggester", version: "2.1" }
    ]
  },
  {
    id: "cmd5",
    task: "Analyze competitor website content",
    description: "Perform a detailed content analysis of top 3 competitor websites",
    status: "running",
    user_id: "user123",
    created_at: "2024-11-01T10:15:00Z",
    updated_at: "2024-11-01T10:16:45Z",
    model: "gpt-4",
    input_tokens: 1850,
    targets: [
      { type: "website", id: "competitor1.com" },
      { type: "website", id: "competitor2.com" },
      { type: "website", id: "competitor3.com" }
    ],
    tools: [
      { name: "web-crawler", version: "2.5" },
      { name: "content-analyzer", version: "3.2" },
      { name: "seo-comparator", version: "1.8" }
    ],
    supervisor: [
      { type: "priority", level: "high" },
      { type: "notification", email: true, slack: true }
    ]
  }
];

// Get mock data for fallback scenarios
export async function getMockCommands(): Promise<Command[]> {
  return mockCommands;
}

export async function getCommands(): Promise<CommandsResponse> {
  try {
    const supabase = await createClient()
    
    // Verificar si estamos usando un cliente mock
    if ((supabase as any)._isMock) {
      console.warn("Se está utilizando un cliente mock de Supabase en getCommands()")
      return { commands: mockCommands, error: "Usando datos mock porque el cliente Supabase es un mock" }
    }
    
    console.log("Iniciando consulta a Supabase en getCommands()...")
    
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
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error en la consulta de Supabase:", error)
      throw error
    }

    console.log(`Datos recibidos de Supabase: ${data?.length || 0} registros`)
    
    // Si no hay datos, retornamos un array vacío en lugar de null
    return { commands: data || [] }
  } catch (error) {
    console.error("Error loading commands:", error)
    // Use mock data in case of error
    return { commands: mockCommands, error: "Error loading commands" }
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