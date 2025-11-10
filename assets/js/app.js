import { hasSupabase, supabase } from './services/supabaseClient.js';
import {
  fetchTreatments,
  fetchProfessionals,
  fetchClientTurns,
  saveTurnDB,
  updateTurnDB,
  deleteTurnDB,
  ensureProfile,
  getCurrentSession,
} from './services/dataService.js';
import { sampleTreatments, sampleProfessionals } from './state/sampleData.js';
import { getState, setState, subscribe } from './state/store.js';
import { renderTreatments, renderProfessionals, renderNextTurns, renderTurnsTable } from './ui/renderers.js';
import { initChatbot } from './ui/chatbot.js';
import { configureModals, openTurnModal, closeTurnModal, openLoginModal, closeLoginModal } from './ui/modals.js';
import { saveLocalSession, loadLocalSession, clearLocalSession } from './services/localSession.js';

const dom = {
  body: document.body,
  treatmentsGrid: document.getElementById('treatments-grid'),
  professionalsGrid: document.getElementById('professionals-grid'),
  nextTurns: document.getElementById('next-turns'),
  turnsTableArea: document.getElementById('turns-table-area'),
  treatmentSearchInput: document.getElementById('t-search'),
  treatmentSearchBtn: document.getElementById('t-search-btn'),
  toggleThemeBtn: document.getElementById('toggle-theme'),
  langSelect: document.getElementById('lang-select'),
  contactForm: document.getElementById('contact-form'),
  brandLink: document.getElementById('brand-link'),
  openTurnBtn: document.getElementById('open-turn'),
  heroRequestBtn: document.getElementById('hero-request'),
  heroTreatBtn: document.getElementById('hero-treat'),
  myTurnsBtn: document.getElementById('my-turns-btn'),
  historyBtn: document.getElementById('history-btn'),
  userStatus: document.getElementById('user-status'),
  loginBtn: document.getElementById('login-btn'),
  adminLink: document.getElementById('admin-link'),
  modalRoot: document.getElementById('modal-root'),
  loginModalRoot: document.getElementById('login-modal-root'),
  chatRoot: document.getElementById('chat-root'),
};

function initState() {
  setState({
    treatments: sampleTreatments,
    filteredTreatments: sampleTreatments,
    professionals: sampleProfessionals,
    filteredProfessionals: sampleProfessionals,
  });
}

function normalizeId(value) {
  return value !== null && value !== undefined ? String(value) : '';
}

function isLocalSessionActive() {
  const session = getState().session;
  return session?.user?.app_metadata?.provider === 'local';
}

function isSchedulingEnabled() {
  return hasSupabase || isLocalSessionActive();
}

function activateLocalSession(email, role = 'client') {
  const safeEmail = email && email.includes('@') ? email : 'demo@clinicamoguz.com';
  const displayName = safeEmail.split('@')[0] || 'Usuario';
  const { session, profile } = saveLocalSession({ email: safeEmail, role, fullName: displayName });
  setState({ session, profile });
  closeLoginModal();
  refreshClientTurns();
  window.alert('Sesión iniciada en modo demo local. Tus turnos se guardarán sólo en este dispositivo.');
}

function findTreatment(identifier) {
  const { treatments, filteredTreatments } = getState();
  const id = normalizeId(identifier);
  const source = [...(filteredTreatments || []), ...(treatments || []), ...(sampleTreatments || [])];
  return source.find((item) => normalizeId(item.id) === id || item.name === identifier);
}

function findProfessional(identifier) {
  const { professionals, filteredProfessionals } = getState();
  const id = normalizeId(identifier);
  const source = [...(filteredProfessionals || []), ...(professionals || []), ...(sampleProfessionals || [])];
  return source.find((item) => normalizeId(item.id) === id || item.name === identifier);
}

async function bootstrapData() {
  if (!hasSupabase) return;
  try {
    const [treatments, professionals] = await Promise.all([fetchTreatments(), fetchProfessionals()]);
    if (treatments.length) {
      setState({ treatments, filteredTreatments: treatments });
    }
    if (professionals.length) {
      setState({ professionals, filteredProfessionals: professionals });
    }
  } catch (error) {
    console.error('Error inicializando datos desde Supabase:', error);
  }
}

async function refreshClientTurns() {
  const { session } = getState();
  if (!session) {
    setState({ turns: [] });
    return [];
  }
  const turns = await fetchClientTurns(session.user.id);
  setState({ turns });
  return turns;
}

function updateNextTurnsUI(state) {
  if (!dom.nextTurns) return;
  if (!state.session) {
    dom.nextTurns.innerHTML =
      '<div style="color:var(--muted);padding:10px;border:1px dashed var(--muted);border-radius:var(--radius-md);margin-top:10px">Iniciá sesión para ver tus próximos turnos.</div>';
    return;
  }
  const upcoming = state.turns.filter((turn) => turn.status !== 'cancelado').slice(0, 3);
  renderNextTurns(dom.nextTurns, upcoming, {
    emptyMessageNoData: 'No hay turnos próximos',
  });
  if (!hasSupabase) {
    dom.nextTurns.innerHTML +=
      '<div style="margin-top:6px;color:var(--muted);font-size:12px">Modo demo activo: los turnos sólo se guardan localmente.</div>';
  }
}

function updateTurnsTableUI(state) {
  if (!dom.turnsTableArea) return;
  if (!state.session) {
    dom.turnsTableArea.innerHTML =
      '<div style="color:var(--muted);padding:10px;border:1px dashed var(--muted);border-radius:var(--radius-md)">Iniciá sesión para ver y administrar tus turnos.</div>';
    return;
  }
  renderTurnsTable(dom.turnsTableArea, state.turns);
  if (!hasSupabase) {
    dom.turnsTableArea.innerHTML +=
      '<div style="margin-top:10px;color:var(--muted);font-size:12px;text-align:center">Modo demo: la información vive en este navegador.</div>';
  }
}

function wireStoreSubscriptions() {
  subscribe((state) => {
    renderTreatments({
      container: dom.treatmentsGrid,
      treatments: state.filteredTreatments,
      onView: handleViewTreatment,
      onRequest: handleRequestFromTreatment,
    });

    renderProfessionals({
      container: dom.professionalsGrid,
      professionals: state.filteredProfessionals,
      onSelect: handleOpenTurnWithProfessional,
    });

    updateNextTurnsUI(state);
    updateTurnsTableUI(state);
    syncAdminLinkVisibility(state);
    syncUserStatus(state);
  });
}

function syncUserStatus(state) {
  if (!dom.userStatus || !dom.loginBtn) return;
  const session = state.session;
  if (session && state.profile) {
    const displayName =
      state.profile.full_name ||
      session.user?.user_metadata?.full_name ||
      (session.user?.email ? session.user.email.split('@')[0] : 'Usuario');
    dom.userStatus.innerHTML = `Bienvenido, <strong>${displayName}</strong> <button id="logout-btn" class="btn btn-ghost" style="margin-left:8px">Cerrar sesión</button>`;
    dom.loginBtn.style.display = 'none';

    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
      if (session.user?.app_metadata?.provider === 'local' || !hasSupabase) {
        clearLocalSession();
        setState({ session: null, profile: null, turns: [] });
      } else {
        await supabase?.auth.signOut();
      }
    });
  } else {
    dom.userStatus.textContent = '';
    dom.loginBtn.style.display = '';
  }
}

function syncAdminLinkVisibility(state) {
  if (!dom.adminLink) return;
  const isAdmin = state.profile?.role === 'admin';
  dom.adminLink.style.display = isAdmin ? '' : 'none';
}

function handleTreatmentSearch() {
  const query = (dom.treatmentSearchInput?.value || '').trim().toLowerCase();
  const { treatments } = getState();
  if (!query) {
    setState({ filteredTreatments: treatments });
    return;
  }
  const matches = treatments.filter((item) => {
    const name = (item.name || '').toLowerCase();
    const specialty = (item.spec || item.specialty || '').toLowerCase();
    return name.includes(query) || specialty.includes(query);
  });
  setState({ filteredTreatments: matches });
}

function handleViewTreatment(identifier) {
  const treatment = findTreatment(identifier);
  if (!treatment) {
    window.alert('No se encontró información del tratamiento seleccionado.');
    return;
  }
  const name = treatment.name || 'Tratamiento';
  const specialty = treatment.spec || treatment.specialty || 'Especialidad a confirmar';
  const duration = treatment.duration || 'Duración estimada a evaluar con el profesional.';
  const info = treatment.description || 'Solicitá una evaluación para conocer más detalles.';
  window.alert(`${name}\n\nEspecialidad: ${specialty}\n${duration}\n\n${info}`);
}

function openTurnFlow({ specialty, professional, date, time, patient } = {}) {
  const { professionals } = getState();
  openTurnModal({
    professionals,
    values: { specialty, professional, date, time, patient },
    isSupabaseAvailable: isSchedulingEnabled(),
    isUserLogged: Boolean(getState().session),
    onRequireAuth: () => handleOpenLoginModal(),
    onSubmit: async (payload) => {
      const { session } = getState();
      if (!session) return;
      const turnRecord = {
        type: payload.type,
        specialty: payload.specialty,
        professional: payload.professional || null,
        date: payload.date,
        time: payload.time,
        patient: payload.patient,
        status: 'pendiente',
        user_id: session.user.id,
      };
      const { error } = await saveTurnDB(turnRecord);
      if (error) {
        console.error('Error guardando turno:', error);
        window.alert('Error al guardar el turno: ' + (error.message || error));
        return;
      }
      closeTurnModal();
      await refreshClientTurns();
      window.alert('Turno solicitado con éxito');
    },
  });
}

function handleRequestFromTreatment(identifier) {
  const treatment = findTreatment(identifier);
  if (!treatment) {
    openTurnFlow();
    return;
  }
  openTurnFlow({ specialty: treatment.spec || treatment.specialty });
}

function handleOpenTurnWithProfessional(identifier) {
  const professional = findProfessional(identifier);
  if (!professional) {
    openTurnFlow();
    return;
  }
  openTurnFlow({ professional: professional.name, specialty: professional.spec || professional.specialty });
}

function handleOpenLoginModal() {
  openLoginModal({
    onSubmit: async (email) => {
      if (!hasSupabase || window.location.protocol === 'file:') {
        activateLocalSession(email);
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
      if (error) {
        console.error('Error enviando Magic Link:', error);
        const useDemo = window.confirm(
          'No pudimos enviar el enlace mágico. ¿Querés iniciar sesión en modo demo local (sin correo)?',
        );
        if (useDemo) {
          activateLocalSession(email);
        } else {
          window.alert('Verificá tu correo o la configuración de Supabase e intentá nuevamente.');
        }
      } else {
        window.alert(`Enlace mágico enviado a ${email}. Revisá tu bandeja de entrada y la carpeta de spam.`);
        closeLoginModal();
      }
    },
    onDemoLogin: () => {
      const input = window.prompt('Ingresá un correo para la sesión demo:', 'demo@clinicamoguz.com');
      const email = (input || '').trim() || 'demo@clinicamoguz.com';
      activateLocalSession(email);
    },
  });
}

async function renderAuthStatus() {
  let sessionData = null;

  if (hasSupabase) {
    try {
      const session = await getCurrentSession();
      if (session) {
        const profile = (await ensureProfile(session)) || {
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email || 'Usuario',
          role: 'client',
        };
        sessionData = { session, profile };
      }
    } catch (error) {
      console.error('Error obteniendo sesión de Supabase:', error);
    }
  }

  if (!sessionData) {
    const local = loadLocalSession();
    if (local?.session && local?.profile) {
      sessionData = local;
    }
  }

  if (sessionData) {
    setState({ session: sessionData.session, profile: sessionData.profile });
    await refreshClientTurns();
  } else {
    setState({ session: null, profile: null, turns: [] });
  }
}

function wireEventListeners() {
  dom.treatmentSearchBtn?.addEventListener('click', handleTreatmentSearch);
  dom.treatmentSearchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleTreatmentSearch();
    }
  });

  dom.toggleThemeBtn?.addEventListener('click', () => {
    dom.body.dataset.theme = dom.body.dataset.theme === 'dark' ? 'light' : 'dark';
  });

  dom.langSelect?.addEventListener('change', (event) => {
    if (event.target.value === 'en') {
      window.alert('Demo: la versión en inglés está en preparación.');
    }
  });

  dom.contactForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    window.alert('Consulta enviada. Nos contactaremos por correo.');
    event.target.reset();
  });

  dom.brandLink?.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  dom.openTurnBtn?.addEventListener('click', () => openTurnFlow());
  dom.heroRequestBtn?.addEventListener('click', () => openTurnFlow());
  dom.heroTreatBtn?.addEventListener('click', () => {
    const target = document.getElementById('tratamientos');
    target?.scrollIntoView({ behavior: 'smooth' });
  });

  dom.myTurnsBtn?.addEventListener('click', async () => {
    await refreshClientTurns();
    const section = document.getElementById('turnos');
    if (section) {
      window.scrollTo({ top: section.offsetTop - 80, behavior: 'smooth' });
    }
  });

  dom.historyBtn?.addEventListener('click', async () => {
    const { session } = getState();
    if (!session) {
      window.alert('Iniciá sesión para consultar tu historial.');
      return;
    }
    const turns = await refreshClientTurns();
    const hist = turns.map((turn) => `${turn.date} ${turn.time} — ${turn.specialty} — ${turn.status}`).join('\n');
    window.alert('Historial:\n\n' + (hist || 'No hay historial'));
  });

  dom.turnsTableArea?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (!action) return;
    const row = target.closest('tr');
    const encodedId = row?.dataset.rowId;
    if (!encodedId) return;
    const turnId = decodeURIComponent(encodedId);
    const { turns } = getState();
    const turn = turns.find((item) => normalizeId(item.id) === normalizeId(turnId));
    if (!turn) {
      window.alert('No encontramos ese turno.');
      return;
    }

    if (action === 'view') {
      window.alert(JSON.stringify(turn, null, 2));
    }

    if (action === 'cancel') {
      if (!window.confirm('¿Confirmar cancelación?')) return;
      const { error } = await updateTurnDB(turn.id, { status: 'cancelado' });
      if (error) {
        console.error('Error cancelando turno:', error);
        window.alert('No pudimos cancelar el turno. Detalle: ' + (error.message || error));
        return;
      }
      await refreshClientTurns();
    }

    if (action === 'reprogram') {
      openTurnModal({
        professionals: getState().professionals,
        values: {
          type: turn.type,
          specialty: turn.specialty,
          professional: turn.professional || '',
          date: turn.date,
          time: turn.time,
          patient: turn.patient,
        },
        isSupabaseAvailable: isSchedulingEnabled(),
        isUserLogged: Boolean(getState().session),
        onRequireAuth: () => handleOpenLoginModal(),
        onSubmit: async (payload) => {
          const updatePayload = {
            type: payload.type,
            specialty: payload.specialty,
            professional: payload.professional || null,
            date: payload.date,
            time: payload.time,
            patient: payload.patient,
          };
          const { error } = await updateTurnDB(turn.id, updatePayload);
          if (error) {
            console.error('Error reprogramando:', error);
            window.alert('No pudimos reprogramar el turno. Detalle: ' + (error.message || error));
            return;
          }
          closeTurnModal();
          await refreshClientTurns();
          window.alert('Turno reprogramado.');
        },
      });
    }
  });

  dom.loginBtn?.addEventListener('click', handleOpenLoginModal);
}

function wireChatbot() {
  if (!dom.chatRoot) return;
  initChatbot({
    root: dom.chatRoot,
    onLoginRequest: handleOpenLoginModal,
    onFetchTurns: async () => {
      const { session } = getState();
      if (!session) return [];
      return await refreshClientTurns();
    },
  });
}

async function main() {
  configureModals({ turnRoot: dom.modalRoot, loginRoot: dom.loginModalRoot });
  initState();
  wireStoreSubscriptions();
  wireEventListeners();
  wireChatbot();
  await bootstrapData();
  await renderAuthStatus();

  if (hasSupabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event)) {
        renderAuthStatus();
      }
    });
  } else {
    console.warn('Supabase no está disponible. Operando en modo demo local.');
  }
}

main();

