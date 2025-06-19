import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { referralCode } = body
    
    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 })
    }

    // First check if this user has already used this referral code
    const { data: existingUse, error: checkError } = await supabase
      .from('referral_code_uses')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (checkError) {
      console.error('Error checking existing referral code use:', checkError)
      return NextResponse.json({ 
        error: 'Failed to check referral code status',
        details: checkError.message 
      }, { status: 500 })
    }

    // If user already has a referral code registered, don't process again
    if (existingUse && existingUse.length > 0) {
      console.log('User already has a referral code registered, skipping processing')
      return NextResponse.json({ 
        success: true, 
        message: 'Referral code already processed',
        alreadyProcessed: true 
      })
    }

    // Insert directly into referral_code_uses table (let trigger handle counter)
    console.log('🔍 Looking for referral code:', referralCode)
    const { data: referralCodeData, error: codeError } = await supabase
      .from('referral_codes')
      .select('id, code, is_active, current_uses, max_uses')
      .eq('code', referralCode)
      .eq('is_active', true)
      .single()

    console.log('📊 Referral code query result:', { referralCodeData, codeError })

    if (codeError || !referralCodeData) {
      console.log('❌ Referral code not found or inactive')
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid or inactive referral code',
        processed: false,
        debug: { codeError, referralCodeData }
      })
    }

    // Check if code has reached max uses
    if (referralCodeData.max_uses && referralCodeData.current_uses >= referralCodeData.max_uses) {
      console.log('❌ Referral code has reached maximum uses')
      return NextResponse.json({ 
        success: false, 
        message: 'Referral code has reached maximum uses',
        processed: false
      })
    }

    console.log('📝 Processing referral code use for user:', user.id)
    
    // Use a transaction to insert the use record and increment the counter atomically
    const { data, error } = await supabase.rpc('process_referral_code_use', {
      p_referral_code_id: referralCodeData.id,
      p_user_id: user.id
    })

    if (error) {
      console.error('❌ Error processing referral code:', error)
      
      // Fallback: try manual transaction
      console.log('🔄 Attempting manual transaction...')
      
      // First insert the use record
      const { data: insertData, error: insertError } = await supabase
        .from('referral_code_uses')
        .insert({
          referral_code_id: referralCodeData.id,
          user_id: user.id,
          used_at: new Date().toISOString()
        })
        .select()

      if (insertError) {
        console.error('❌ Error inserting referral code use:', insertError)
        return NextResponse.json({ 
          error: 'Failed to process referral code',
          details: insertError.message
        }, { status: 500 })
      }

      // Then increment the counter
      const { error: updateError } = await supabase
        .from('referral_codes')
        .update({ current_uses: referralCodeData.current_uses + 1 })
        .eq('id', referralCodeData.id)

      if (updateError) {
        console.error('❌ Error updating referral code counter:', updateError)
        // Try to rollback the insert
        await supabase
          .from('referral_code_uses')
          .delete()
          .eq('referral_code_id', referralCodeData.id)
          .eq('user_id', user.id)
        
        return NextResponse.json({ 
          error: 'Failed to update referral code counter',
          details: updateError.message
        }, { status: 500 })
      }

      console.log('✅ Manual transaction completed successfully')
      return NextResponse.json({ 
        success: true, 
        message: 'Referral code processed successfully (manual)',
        processed: true,
        data: insertData?.[0],
        method: 'manual'
      })
    }

    console.log('✅ Referral code processed successfully via RPC:', data)
    return NextResponse.json({ 
      success: true, 
      message: 'Referral code processed successfully',
      processed: true,
      data: data,
      method: 'rpc'
    })

  } catch (error: any) {
    console.error('Error in process-referral endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Referral code processing endpoint',
    usage: 'POST with { referralCode: "CODE" } to process a referral code for the authenticated user'
  })
} 