import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabase = null;

try {
  const urlFromWindow = window.__SUPABASE_URL__;
  const keyFromWindow = window.__SUPABASE_ANON_KEY__;
  const projectUrl = urlFromWindow || SUPABASE_URL;
  const anonKey = keyFromWindow || SUPABASE_ANON_KEY;

  if (projectUrl && anonKey) {
    supabase = createClient(projectUrl, anonKey, {
      auth: {
        persistSession: true,
      },
    });
  } else {
    console.warn('Supabase: faltan SUPABASE_URL o SUPABASE_ANON_KEY. Inicialización omitida.');
  }
} catch (error) {
  console.warn('No fue posible inicializar Supabase:', error);
  supabase = null;
}

export const hasSupabase = Boolean(supabase);
export { supabase };

