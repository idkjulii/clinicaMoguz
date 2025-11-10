const LOCAL_TURNS_KEY = 'moguz-local-turns';

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function loadAllTurns() {
  try {
    const raw = localStorage.getItem(LOCAL_TURNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudieron cargar los turnos locales:', error);
    return [];
  }
}

function persistTurns(turns) {
  localStorage.setItem(LOCAL_TURNS_KEY, JSON.stringify(turns));
}

export function listLocalTurns(filters = {}) {
  let turns = loadAllTurns();
  if (filters.user_id) {
    const normalized = String(filters.user_id);
    turns = turns.filter((turn) => String(turn.user_id) === normalized);
  }
  if (filters.status) {
    turns = turns.filter((turn) => turn.status === filters.status);
  }
  if (filters.from) {
    turns = turns.filter((turn) => (turn.date || '') >= filters.from);
  }
  if (filters.to) {
    turns = turns.filter((turn) => (turn.date || '') <= filters.to);
  }
  return turns;
}

export function listLocalTurnsByUser(userId) {
  if (!userId) return [];
  return listLocalTurns({ user_id: userId });
}

export function addLocalTurn(record) {
  const turns = loadAllTurns();
  const newRecord = { ...record, id: record.id || randomId() };
  turns.push(newRecord);
  persistTurns(turns);
  return newRecord;
}

export function updateLocalTurn(id, updates) {
  const turns = loadAllTurns();
  const idx = turns.findIndex((turn) => String(turn.id) === String(id));
  if (idx === -1) return null;
  turns[idx] = { ...turns[idx], ...updates };
  persistTurns(turns);
  return turns[idx];
}

export function deleteLocalTurn(id) {
  const turns = loadAllTurns();
  const filtered = turns.filter((turn) => String(turn.id) !== String(id));
  persistTurns(filtered);
  return filtered.length !== turns.length ? null : new Error('Turno no encontrado');
}

