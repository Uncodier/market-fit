import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  // Clear all Supabase cookies
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token', 
    'supabase-auth-token',
    'sb-provider-token',
    'sb-auth-token'
  ]
  
  // Create a response
  const response = NextResponse.json({ 
    success: true, 
    message: 'Session cleared. Please log in again.' 
  })
  
  // Clear cookies using the response
  for (const name of cookiesToClear) {
    response.cookies.delete(name)
  }
  
  return response
}
