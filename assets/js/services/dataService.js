import { supabase, hasSupabase } from './supabaseClient.js';

export async function fetchTreatments() {
  if (!hasSupabase) return [];
  try {
    const { data, error } = await supabase.from('treatments').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando tratamientos:', error);
    return [];
  }
}

export async function fetchProfessionals() {
  if (!hasSupabase) return [];
  try {
    const { data, error } = await supabase.from('professionals').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando profesionales:', error);
    return [];
  }
}

export async function fetchClientTurns(userId) {
  if (!hasSupabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('turns')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error obteniendo turnos del cliente:', error);
    return [];
  }
}

export async function fetchTurns(filters = {}) {
  if (!hasSupabase) return [];
  try {
    let query = supabase.from('turns').select('*').order('date', { ascending: true }).order('time', { ascending: true });
    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando turnos:', error);
    return [];
  }
}

export async function saveTurnDB(turn) {
  if (!hasSupabase) {
    console.warn('Supabase no disponible: el turno se mantiene en memoria.');
    return { error: null, skipped: true };
  }
  try {
    const { data, error } = await supabase.from('turns').insert([turn]).select('*').maybeSingle();
    if (error) throw error;
    return { error: null, data };
  } catch (error) {
    return { error };
  }
}

export async function updateTurnDB(id, payload) {
  if (!hasSupabase) return { error: new Error('Supabase inactivo') };
  try {
    const { error } = await supabase.from('turns').update(payload).eq('id', id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function deleteTurnDB(id) {
  if (!hasSupabase) return { error: new Error('Supabase inactivo') };
  try {
    const { error } = await supabase.from('turns').delete().eq('id', id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function ensureProfile(session) {
  if (!hasSupabase || !session?.user) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const defaultName =
      session.user.user_metadata?.full_name ||
      (session.user.email ? session.user.email.split('@')[0] : 'Usuario');

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, full_name: defaultName, role: 'client' })
      .select('id, full_name, role')
      .maybeSingle();

    if (insertError) throw insertError;
    return inserted || { id: session.user.id, full_name: defaultName, role: 'client' };
  } catch (error) {
    console.error('Error gestionando perfil:', error);
    return null;
  }
}

export async function getCurrentSession() {
  if (!hasSupabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  } catch (error) {
    console.error('Error obteniendo sesión actual:', error);
    return null;
  }
}

