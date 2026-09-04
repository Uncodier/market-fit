import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { record_id } = await request.json()

    if (!record_id) {
      return NextResponse.json({ error: 'record_id is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // 1. Fetch the record just to get the site_id and confirm it exists
    const { data: record, error: recordError } = await supabase
      .from('records')
      .select('site_id')
      .eq('id', record_id)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const apiServerUrl = (process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '').trim();
    const serviceApiKey = process.env.SERVICE_API_KEY?.trim();

    if (!apiServerUrl) {
      return NextResponse.json({ error: 'API_SERVER_URL is not configured' }, { status: 500 });
    }
    if (!serviceApiKey) {
      return NextResponse.json({ error: 'SERVICE_API_KEY is not configured' }, { status: 500 });
    }

    // 2. Generate summary via the central API helper
    const summaryEndpoint = `${apiServerUrl.replace(/\/$/, '')}/api/ai/summary`;
    
    const summaryResponse = await fetch(summaryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': serviceApiKey,
      },
      body: JSON.stringify({
        source: {
          collection: 'records',
          id: record_id
        },
        site_id: record.site_id
      }),
    });

    if (!summaryResponse.ok) {
      const errText = await summaryResponse.text();
      console.error('Central API summary error:', errText);
      return NextResponse.json({ error: 'Failed to generate summary with Central API' }, { status: 500 });
    }

    const summaryData = await summaryResponse.json();
    const generatedSummary = summaryData.summary;

    if (!generatedSummary) {
      console.error('Central API summary returned no text:', summaryData);
      return NextResponse.json({ error: 'No summary returned from Central API' }, { status: 500 });
    }

    // 3. Generate the embedding via the central API using the generated summary
    const embeddingsEndpoint = `${apiServerUrl.replace(/\/$/, '')}/api/ai/embeddings`;

    const embeddingsResponse = await fetch(embeddingsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': serviceApiKey,
      },
      body: JSON.stringify({
        input: generatedSummary,
        modelId: 'text-embedding-3-small',
      }),
    });

    if (!embeddingsResponse.ok) {
      const errText = await embeddingsResponse.text();
      console.error('Central API embedding error:', errText);
      return NextResponse.json({ error: 'Failed to generate embedding with Central API' }, { status: 500 });
    }

    const embedData = await embeddingsResponse.json();
    const embedding = embedData.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      console.error('Central API embedding returned no values:', embedData);
      return NextResponse.json({ error: 'No embedding returned from Central API' }, { status: 500 });
    }

    // 4. Update the record with both the summary and embedding
    const { error: updateError } = await supabase
      .from('records')
      .update({ summary: generatedSummary, embedding })
      .eq('id', record_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save summary and embedding' }, { status: 500 })
    }

    return NextResponse.json({ success: true, summary: generatedSummary })

  } catch (error: any) {
    console.error('Error in record embed API:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
