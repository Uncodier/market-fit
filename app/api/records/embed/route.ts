import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { record_id } = await request.json()

    if (!record_id) {
      return NextResponse.json({ error: 'record_id is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // 1. Fetch the record
    const { data: record, error: recordError } = await supabase
      .from('records')
      .select('*, category:record_categories(*)')
      .eq('id', record_id)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // 2. Build the semantic text to embed
    let textToEmbed = `Title: ${record.title}\n`
    if (record.description) {
      textToEmbed += `Description: ${record.description}\n`
    }
    
    // Add category info
    if (record.category) {
      textToEmbed += `Category: ${record.category.name}\n`
    }

    // Add data fields
    if (record.data && typeof record.data === 'object') {
      textToEmbed += `Data:\n`
      for (const [key, value] of Object.entries(record.data)) {
        if (typeof value === 'string' || typeof value === 'number') {
           textToEmbed += `- ${key}: ${value}\n`
        }
      }
    }

    // 3. Resolve relations for higher semantic value
    if (record.relations && typeof record.relations === 'object') {
      textToEmbed += `Relations:\n`
      for (const [relType, relId] of Object.entries(record.relations)) {
        if (!relId || typeof relId !== 'string') continue;
        
        try {
          if (relType === 'lead' || relType === 'leads') {
            const { data } = await supabase.from('leads').select('name, company, status').eq('id', relId).single()
            if (data) textToEmbed += `- Linked to Lead: ${data.name || 'Unknown'} (Company: ${data.company || 'N/A'}, Status: ${data.status || 'N/A'})\n`
          } 
          else if (relType === 'company' || relType === 'companies') {
            const { data } = await supabase.from('companies').select('name, industry').eq('id', relId).single()
            if (data) textToEmbed += `- Linked to Company: ${data.name || 'Unknown'} (Industry: ${data.industry || 'N/A'})\n`
          }
          else if (relType === 'sales_order' || relType === 'orders') {
            const { data } = await supabase.from('orders').select('order_number, total, status').eq('id', relId).single()
            if (data) textToEmbed += `- Linked to Sales Order: ${data.order_number || 'Unknown'} (Total: ${data.total || 0}, Status: ${data.status || 'N/A'})\n`
          }
          else if (relType === 'deal' || relType === 'deals') {
            const { data } = await supabase.from('deals').select('title, value, stage').eq('id', relId).single()
            if (data) textToEmbed += `- Linked to Deal: ${data.title || 'Unknown'} (Value: ${data.value || 0}, Stage: ${data.stage || 'N/A'})\n`
          }
          else if (relType === 'campaign' || relType === 'campaigns') {
            const { data } = await supabase.from('campaigns').select('name, status').eq('id', relId).single()
            if (data) textToEmbed += `- Linked to Campaign: ${data.name || 'Unknown'} (Status: ${data.status || 'N/A'})\n`
          }
          else {
            textToEmbed += `- Linked to ${relType} (ID: ${relId})\n`
          }
        } catch (err) {
          // Ignore failed relations
        }
      }
    }

    // 4. Generate the embedding using Gemini
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // El modelo exacto según la API de Gemini es models/text-embedding-004
    const aiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: textToEmbed }]
        },
        // We explicitly request 1536 dimensions to match Supabase's vector(1536) type
        outputDimensionality: 1536
      })
    })

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini embedding error:", errText);
      return NextResponse.json({ error: 'Failed to generate embedding with Gemini' }, { status: 500 })
    }

    const embedData = await response.json()
    const embedding = embedData.embedding?.values

    if (!embedding || !Array.isArray(embedding)) {
      console.error("Gemini embedding returned no values:", embedData);
      return NextResponse.json({ error: 'No embedding returned from Gemini' }, { status: 500 })
    }

    // 5. Update the record
    const { error: updateError } = await supabase
      .from('records')
      .update({ embedding })
      .eq('id', record_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save embedding' }, { status: 500 })
    }

    return NextResponse.json({ success: true, text_embedded: textToEmbed })

  } catch (error: any) {
    console.error('Error in record embed API:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}