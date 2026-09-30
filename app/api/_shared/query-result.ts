import type { PostgrestError } from '@supabase/supabase-js'

/** Explicit projection boundary for clients whose demo branch lacks schema inference. */
export type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
  count?: number | null
}