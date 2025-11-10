import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rfcvgihqcyzvpofgddzh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmY3ZnaWhxY3l6dnBvZmdkZHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTEzODUsImV4cCI6MjA3ODMyNzM4NX0.Cy508tNLMQLUtGupFcrHDTBa1MnfkvMF9Xp0z-3jJgo";

let client;

export function getSupabaseClient() {
  if (typeof client !== "undefined") {
    return client;
  }
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    console.warn("No fue posible inicializar Supabase.", error);
    client = null;
  }
  return client;
}

export function hasSupabase() {
  return Boolean(getSupabaseClient());
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

export async function ensureProfile(session) {
  const supabase = getSupabaseClient();
  if (!supabase || !session?.user) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;

    const defaultName =
      session.user.user_metadata?.full_name ||
      (session.user.email ? session.user.email.split("@")[0] : "Paciente");

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: session.user.id, full_name: defaultName, role: "client" })
      .select("id, full_name, role")
      .maybeSingle();

    if (insertError) throw insertError;
    return (
      inserted || {
        id: session.user.id,
        full_name: defaultName,
        role: "client",
      }
    );
  } catch (error) {
    console.error("No se pudo asegurar el perfil del usuario.", error);
    return null;
  }
}

export function onAuthChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => {
    listener.subscription.unsubscribe();
  };
}

export async function fetchTreatments() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("treatments").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfessionals() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("professionals").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientTurns(session) {
  const supabase = getSupabaseClient();
  if (!supabase || !session?.user) return [];
  const { data, error } = await supabase
    .from("turns")
    .select("*")
    .eq("user_id", session.user.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTurnsWithFilters(filters = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  let query = supabase.from("turns").select("*").order("date", { ascending: true }).order("time", { ascending: true });
  if (filters.user_id) query = query.eq("user_id", filters.user_id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveTurn(payload) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase no disponible.");
  const { data, error } = await supabase.from("turns").insert([payload]).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTurn(id, payload) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase no disponible.");
  const { error } = await supabase.from("turns").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteTurn(id) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase no disponible.");
  const { error } = await supabase.from("turns").delete().eq("id", id);
  if (error) throw error;
}

export function onTurnsRealtime(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const channel = supabase
    .channel("realtime:turns")
    .on("postgres_changes", { event: "*", schema: "public", table: "turns" }, callback)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

