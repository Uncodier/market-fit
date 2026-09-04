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

    // 4. Generate the embedding via the central API (Portkey + text-embedding-3-small)
    const apiServerUrl = (process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '').trim();
    const serviceApiKey = process.env.SERVICE_API_KEY?.trim();

    if (!apiServerUrl) {
      return NextResponse.json({ error: 'API_SERVER_URL is not configured' }, { status: 500 });
    }
    if (!serviceApiKey) {
      return NextResponse.json({ error: 'SERVICE_API_KEY is not configured' }, { status: 500 });
    }

    const aiEndpoint = `${apiServerUrl.replace(/\/$/, '')}/api/ai/embeddings`;

    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': serviceApiKey,
      },
      body: JSON.stringify({
        input: textToEmbed,
        modelId: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Central API embedding error:', errText);
      return NextResponse.json({ error: 'Failed to generate embedding with Central API' }, { status: 500 });
    }

    const embedData = await response.json();
    const embedding = embedData.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      console.error('Central API embedding returned no values:', embedData);
      return NextResponse.json({ error: 'No embedding returned from Central API' }, { status: 500 });
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