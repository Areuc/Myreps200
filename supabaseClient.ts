import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { Database } from './types';

const supabaseUrl = "https://slszakimpkvnnzvostlp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsc3pha2ltcGt2bm56dm9zdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NjA0NjUsImV4cCI6MjA2NjQzNjQ2NX0.AjJX6qRHGMFquEaqTCFXDNMTQDRgJYEy7ROTJ7KQn-M";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
