
import { createClient } from '@supabase/supabase-js'

// Make sure to read the environment variables correctly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we have the required values and provide meaningful error messages
if (!supabaseUrl) {
  console.error("Error: VITE_SUPABASE_URL environment variable is not set")
}
if (!supabaseAnonKey) {
  console.error("Error: VITE_SUPABASE_ANON_KEY environment variable is not set")
}

// Create the Supabase client with proper error handling
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)
