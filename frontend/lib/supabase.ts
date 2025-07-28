// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Note: This client is intended for use in client components or browser environments.
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default supabase;