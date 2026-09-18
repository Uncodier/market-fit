import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { processRecordEmbeddingsById } from "@/app/records/lib/record-embedding-worker"

const bodySchema = z.object({
  record_id: z.string().uuid(),
  changed_node_ids: z.array(z.string().uuid()).max(200).optional(),
}).strict()

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const input = bodySchema.parse(await request.json())
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: record, error: recordError } = await supabase
      .from("records")
      .select("id")
      .eq("id", input.record_id)
      .maybeSingle()
    if (recordError) throw recordError
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    const result = await processRecordEmbeddingsById({
      recordId: input.record_id,
      requestedNodeIds: input.changed_node_ids,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[record embedding]", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid embedding request" }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to index record" },
      { status: 500 }
    )
  }
}
