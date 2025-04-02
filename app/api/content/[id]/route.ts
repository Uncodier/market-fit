import { NextResponse } from "next/server"
import { getContentById, updateContent } from "@/app/content/actions"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getContentById(params.id)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json(result.content)
  } catch (error) {
    console.error("Error in content API route:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const result = await updateContent({
      contentId: params.id,
      ...body
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result.content)
  } catch (error) {
    console.error('Error updating content:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
} 