
import { createClient } from '@supabase/supabase-js'

// Use hardcoded values for the Supabase project until environment variables are available
const supabaseUrl = 'https://mfcdlifjxxdrekzdatfb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk'

// Create the Supabase client with proper error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For debugging purposes
console.log('Supabase client initialized with URL:', supabaseUrl)
