import { hasSupabase, supabase } from '../services/supabaseClient.js';
import {
  fetchTreatments,
  fetchProfessionals,
  fetchTurns,
  ensureProfile,
  updateTurnDB,
  deleteTurnDB,
} from '../services/dataService.js';

const dom = {
  alerts: document.getElementById('alerts'),
  authGuard: document.getElementById('auth-guard'),
  content: document.getElementById('content'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  filterStatus: document.getElementById('filter-status'),
  filterFrom: document.getElementById('filter-from'),
  filterTo: document.getElementById('filter-to'),
  refreshTurns: document.getElementById('refresh-turns'),
  refreshPros: document.getElementById('refresh-pros'),
  refreshTreatments: document.getElementById('refresh-treatments'),
  turnsTableBody: document.querySelector('#turns-table tbody'),
  prosList: document.getElementById('pros-list'),
  treatmentsList: document.getElementById('treatments-list'),
  summaryTurns: document.getElementById('summary-turns'),
  summaryPending: document.getElementById('summary-pending'),
  summaryPros: document.getElementById('summary-pros'),
};

const state = {
  session: null,
  profile: null,
  professionals: [],
  turns: [],
};

function showAlert(type, message) {
  if (!dom.alerts) return;
  const div = document.createElement('div');
  div.className = type;
  div.textContent = message;
  dom.alerts.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function ensureSupabase() {
  if (!hasSupabase) {
    showAlert('error', 'Supabase no está disponible. Revisa la configuración de claves.');
    return false;
  }
  return true;
}

async function resolveSession() {
  if (!ensureSupabase()) return false;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    state.session = session || null;
    if (!session) {
      dom.authGuard?.classList.remove('hidden');
      dom.content?.classList.add('hidden');
      return false;
    }
    const profile = await ensureProfile(session);
    state.profile = profile;
    if (!profile || profile.role !== 'admin') {
      dom.authGuard?.classList.remove('hidden');
      if (dom.authGuard) {
        dom.authGuard.innerHTML =
          'Tu usuario no tiene permisos de administrador. Contactá al dueño de la clínica.';
      }
      dom.content?.classList.add('hidden');
      return false;
    }
    dom.authGuard?.classList.add('hidden');
    dom.content?.classList.remove('hidden');
    return true;
  } catch (error) {
    console.error('No se pudo obtener la sesión:', error);
    showAlert('error', 'No se pudo obtener la sesión.');
    dom.authGuard?.classList.remove('hidden');
    dom.content?.classList.add('hidden');
    return false;
  }
}

function renderProfessionalList() {
  if (!dom.prosList) return;
  const professionals = state.professionals;
  if (!professionals.length) {
    dom.prosList.textContent = 'No hay profesionales cargados.';
    dom.summaryPros.textContent = '0';
    return;
  }
  dom.summaryPros.textContent = String(professionals.length);
  dom.prosList.innerHTML = professionals
    .map(
      (pro) => `
      <div style="border-bottom:1px solid #e2e8f0;padding:8px 0;">
        <strong>${pro.name}</strong><br>
        <span class="muted">${pro.specialty || pro.spec || ''}</span><br>
        <span class="muted">${pro.bio || ''}</span>
      </div>
    `,
    )
    .join('');
}

function renderTreatmentList(treatments) {
  if (!dom.treatmentsList) return;
  if (!treatments.length) {
    dom.treatmentsList.textContent = 'No hay tratamientos cargados.';
    return;
  }
  dom.treatmentsList.innerHTML = treatments
    .map(
      (treatment) => `
      <div style="border-bottom:1px solid #e2e8f0;padding:8px 0;">
        <strong>${treatment.name}</strong><br>
        <span class="muted">${treatment.specialty || treatment.spec || ''}</span>
      </div>
    `,
    )
    .join('');
}

function professionalOptionsMarkup(selectedValue = '') {
  const options = ['<option value="">Sin asignar</option>'];
  state.professionals.forEach((pro) => {
    const value = pro.name;
    const selected = value === selectedValue ? ' selected' : '';
    options.push(`<option value="${value}"${selected}>${value} — ${pro.specialty || pro.spec || ''}</option>`);
  });
  return options.join('');
}

function statusPill(status) {
  const normalized = status || 'pendiente';
  const className = `status-pill status-${normalized}`;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `<span class="${className}">${label}</span>`;
}

function renderTurnsTable(turns) {
  if (!dom.turnsTableBody) return;
  if (!turns.length) {
    dom.turnsTableBody.innerHTML = '<tr><td colspan="7" class="muted">No hay turnos con los filtros seleccionados.</td></tr>';
    return;
  }

  dom.summaryTurns.textContent = String(turns.length);
  dom.summaryPending.textContent = String(turns.filter((turn) => turn.status === 'pendiente').length);

  dom.turnsTableBody.innerHTML = turns
    .map(
      (turn) => `
      <tr data-id="${turn.id}">
        <td>${turn.date}</td>
        <td>${turn.time}</td>
        <td>${turn.patient}</td>
        <td>${turn.type}</td>
        <td>
          <select data-action="assign-professional">
            ${professionalOptionsMarkup(turn.professional)}
          </select>
        </td>
        <td>${statusPill(turn.status)}</td>
        <td>
          <div class="table-actions">
            <select data-action="set-status">
              <option value="pendiente"${turn.status === 'pendiente' ? ' selected' : ''}>Pendiente</option>
              <option value="confirmado"${turn.status === 'confirmado' ? ' selected' : ''}>Confirmado</option>
              <option value="cancelado"${turn.status === 'cancelado' ? ' selected' : ''}>Cancelado</option>
            </select>
            <button class="ghost" data-action="view-json">Ver</button>
            <button data-action="delete-turn" style="background:#dc2626;">Eliminar</button>
          </div>
        </td>
      </tr>
    `,
    )
    .join('');
}

async function loadProfessionals() {
  if (!ensureSupabase()) return;
  dom.prosList.textContent = 'Cargando...';
  try {
    const professionals = await fetchProfessionals();
    state.professionals = professionals;
    renderProfessionalList();
  } catch (error) {
    dom.prosList.innerHTML = `<div class="error">No se pudieron cargar los profesionales. ${error.message}</div>`;
  }
}

async function loadTreatments() {
  if (!ensureSupabase()) return;
  dom.treatmentsList.textContent = 'Cargando...';
  try {
    const treatments = await fetchTreatments();
    renderTreatmentList(treatments);
  } catch (error) {
    dom.treatmentsList.innerHTML = `<div class="error">No se pudieron cargar los tratamientos. ${error.message}</div>`;
  }
}

async function loadTurns() {
  if (!ensureSupabase()) return;
  dom.turnsTableBody.innerHTML = '<tr><td colspan="7" class="muted">Cargando...</td></tr>';
  try {
    const filters = {};
    if (dom.filterStatus?.value) filters.status = dom.filterStatus.value;
    if (dom.filterFrom?.value) filters.from = dom.filterFrom.value;
    if (dom.filterTo?.value) filters.to = dom.filterTo.value;
    const turns = await fetchTurns(filters);
    state.turns = turns;
    renderTurnsTable(turns);
  } catch (error) {
    dom.turnsTableBody.innerHTML = `<tr><td colspan="7" class="error">No se pudieron cargar los turnos. ${error.message}</td></tr>`;
  }
}

function handleTurnsTableChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const action = target.dataset.action;
  if (!action) return;
  const row = target.closest('tr');
  const turnId = row?.dataset.id;
  if (!turnId) return;

  if (action === 'assign-professional') {
    updateTurnDB(turnId, { professional: target.value || null })
      .then(({ error }) => {
        if (error) {
          showAlert('error', `No se pudo actualizar el turno ${turnId}. ${error.message}`);
        } else {
          showAlert('success', 'Cambios guardados.');
          loadTurns();
        }
      })
      .catch((error) => showAlert('error', `No se pudo actualizar el turno ${turnId}. ${error.message}`));
  }

  if (action === 'set-status') {
    updateTurnDB(turnId, { status: target.value })
      .then(({ error }) => {
        if (error) {
          showAlert('error', `No se pudo actualizar el turno ${turnId}. ${error.message}`);
        } else {
          showAlert('success', 'Cambios guardados.');
          loadTurns();
        }
      })
      .catch((error) => showAlert('error', `No se pudo actualizar el turno ${turnId}. ${error.message}`));
  }
}

function handleTurnsTableClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;
  const row = target.closest('tr');
  const turnId = row?.dataset.id;
  if (!turnId) return;

  if (action === 'view-json') {
    const record = state.turns.find((turn) => turn.id === turnId);
    if (!record) {
      showAlert('error', 'No pudimos traer el detalle.');
      return;
    }
    window.alert(JSON.stringify(record, null, 2));
  }

  if (action === 'delete-turn') {
    if (!window.confirm('¿Eliminar turno definitivamente?')) return;
    deleteTurnDB(turnId)
      .then(({ error }) => {
        if (error) {
          showAlert('error', `No se pudo eliminar el turno. ${error.message}`);
        } else {
          showAlert('success', 'Turno eliminado.');
          loadTurns();
        }
      })
      .catch((error) => showAlert('error', `No se pudo eliminar el turno. ${error.message}`));
  }
}

function wireEvents() {
  dom.refreshTurns?.addEventListener('click', loadTurns);
  dom.refreshPros?.addEventListener('click', loadProfessionals);
  dom.refreshTreatments?.addEventListener('click', loadTreatments);
  dom.turnsTableBody?.addEventListener('change', handleTurnsTableChange);
  dom.turnsTableBody?.addEventListener('click', handleTurnsTableClick);

  dom.loginBtn?.addEventListener('click', async () => {
    if (!ensureSupabase()) return;
    const email = window.prompt('Ingresá el correo del administrador:');
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      showAlert('error', 'No se pudo enviar el enlace mágico.');
    } else {
      showAlert('success', 'Enviamos un enlace mágico a tu correo.');
    }
  });

  dom.logoutBtn?.addEventListener('click', async () => {
    if (!ensureSupabase()) return;
    await supabase.auth.signOut();
    window.location.reload();
  });
}

async function init() {
  if (!(await resolveSession())) return;
  await Promise.all([loadProfessionals(), loadTreatments(), loadTurns()]);

  if (hasSupabase) {
    supabase
      .channel('realtime:turns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turns' }, () => loadTurns())
      .subscribe();
  }
}

wireEvents();
init();

