"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/app/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export function SupabaseDebugger() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const testSupabaseConnection = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    
    try {
      // Check environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase environment variables")
      }
      
      // Test direct fetch to Supabase
      console.log("Testing direct fetch to Supabase...")
      const fetchResponse = await fetch(`${supabaseUrl}/rest/v1/commands?select=count`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })
      
      // Test Supabase client
      console.log("Testing Supabase client...")
      const supabase = createClient()
      const { data, error: supabaseError } = await supabase.from("commands").select("count").limit(1)
      
      if (supabaseError) {
        throw supabaseError
      }
      
      // Set results
      setResults({
        directFetch: {
          status: fetchResponse.status,
          ok: fetchResponse.ok,
          statusText: fetchResponse.statusText
        },
        supabaseClient: {
          success: true,
          data
        },
        environment: {
          supabaseUrl: supabaseUrl.substring(0, 15) + "...",
          supabaseKeyAvailable: !!supabaseKey
        }
      })
      
      console.log("Connection Test Successful: Supabase connection is working properly")
    } catch (err) {
      console.error("Debug test error:", err)
      setError(err instanceof Error ? err.message : String(err))
      
      console.error("Connection Test Failed:", err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Supabase Connection Debugger</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-red-800 text-sm">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {results && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 text-green-800 text-sm">
            <p className="font-medium">Results</p>
            <pre className="mt-2 text-xs whitespace-pre-wrap">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={testSupabaseConnection} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? "Testing..." : "Test Supabase Connection"}
        </Button>
      </CardFooter>
    </Card>
  )
} 