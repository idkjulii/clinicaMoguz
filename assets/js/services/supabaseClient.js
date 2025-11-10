import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://rfcvgihqcyzvpofgddzh.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmY3ZnaWhxY3l6dnBvZmdkZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTEzODUsImV4cCI6MjA3ODMyNzM4NX0.Cy508tNLMQLUtGupFcrHDTBa1MnfkvMF9Xp0z-3jJgo';

let supabase = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
      },
    });
  }
} catch (error) {
  console.warn('No fue posible inicializar Supabase:', error);
  supabase = null;
}

export const hasSupabase = Boolean(supabase);
export { supabase };

