import {
  getSupabaseClient,
  hasSupabase,
  getCurrentSession,
  ensureProfile,
  fetchTreatments,
  fetchProfessionals,
  fetchClientTurns,
  saveTurn,
  updateTurn,
  deleteTurn,
  onAuthChange,
  onTurnsRealtime,
} from "./services/supabaseClient.js";
import { getState, setState, updateState, subscribe, persistTheme } from "./state/store.js";
import { showToast } from "./ui/feedback.js";

const FALLBACK_TREATMENTS = [
  {
    id: 1,
    name: "Rinoplastía",
    spec: "Cirugía facial",
    img: "https://images.unsplash.com/photo-1605902711622-cfb43c44367e?q=80&w=1100&auto=format&fit=crop&ixlib=rb-4.0.3",
  },
  {
    id: 2,
    name: "Liposucción",
    spec: "Contorno corporal",
    img: "https://images.unsplash.com/photo-1556228720-3b9ce3b1d8d2?q=80&w=1100&auto=format&fit=crop&ixlib=rb-4.0.3",
  },
  {
    id: 3,
    name: "Aumento mamario",
    spec: "Cirugía mamaria",
    img: "https://images.unsplash.com/photo-1597764696389-2d98a6a2b7f9?q=80&w=1100&auto=format&fit=crop&ixlib=rb-4.0.3",
  },
  {
    id: 4,
    name: "Toxina botulínica",
    spec: "Estética",
    img: "https://images.unsplash.com/photo-1600195077073-7f2d3b47f8d6?q=80&w=1100&auto=format&fit=crop&ixlib=rb-4.0.3",
  },
];

const FALLBACK_PROFESSIONALS = [
  { id: 1, name: "Dra. Ana Moguz", spec: "Cirugía Plástica", bio: "Matrícula 12345. 15 años de experiencia." },
  { id: 2, name: "Dr. Luis Pérez", spec: "Cirugía Reconstructiva", bio: "Especialista en reconstrucción post-trauma." },
  { id: 3, name: "Dr. Mario Morales Guzman", spec: "Estética", bio: "Experticia en tratamientos mínimamente invasivos." },
];

const FALLBACK_TURN_MESSAGE =
  "Iniciá sesión para ver tus próximos turnos. Gestioná tus solicitudes en pocos minutos y recibí actualizaciones en tiempo real.";

const DOM = {};
const chatHistory = [];
let treatmentQuery = "";
let realtimeUnsubscribe = null;

init();

function init() {
  cacheDom();
  bindCoreEvents();
  initSubscriptions();
  // Cargar datos base en memoria (fallback)
  setState({
    treatments: FALLBACK_TREATMENTS,
    professionals: FALLBACK_PROFESSIONALS,
  });
  renderChat(getState());

  if (hasSupabase()) {
    bootstrapSupabase();
  } else {
    informSupabaseUnavailable();
  }
}

function cacheDom() {
  DOM.body = document.body;
  DOM.navToggle = document.getElementById("nav-toggle");
  DOM.navMenu = document.getElementById("nav-menu");
  DOM.brandLink = document.getElementById("brand-link");
  DOM.langSelect = document.getElementById("lang-select");
  DOM.themeToggle = document.getElementById("toggle-theme");
  DOM.openTurnButtons = document.querySelectorAll("[data-action='open-turn-modal']");
  DOM.heroTreat = document.getElementById("hero-treat");
  DOM.treatmentsGrid = document.getElementById("treatments-grid");
  DOM.professionalsGrid = document.getElementById("professionals-grid");
  DOM.nextTurns = document.getElementById("next-turns");
  DOM.turnsTable = document.getElementById("turns-table-area");
  DOM.treatmentSearchInput = document.getElementById("t-search");
  DOM.treatmentSearchButton = document.getElementById("t-search-btn");
  DOM.myTurnsBtn = document.getElementById("my-turns-btn");
  DOM.historyBtn = document.getElementById("history-btn");
  DOM.contactForm = document.getElementById("contact-form");
  DOM.modalRoot = document.getElementById("modal-root");
  DOM.loginModalRoot = document.getElementById("login-modal-root");
  DOM.chatRoot = document.getElementById("chat-root");
  DOM.toastRoot = document.getElementById("toast-root");
  DOM.userStatus = document.getElementById("user-status");
  DOM.loginBtn = document.getElementById("login-btn");
  DOM.adminLink = document.getElementById("admin-link");
}

function bindCoreEvents() {
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("submit", handleGlobalSubmit);
  if (DOM.treatmentSearchInput) {
    DOM.treatmentSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleTreatmentSearch();
      }
    });
  }
  if (DOM.treatmentSearchButton) {
    DOM.treatmentSearchButton.addEventListener("click", handleTreatmentSearch);
  }
  if (DOM.langSelect) {
    DOM.langSelect.addEventListener("change", handleLanguageChange);
  }
  if (DOM.contactForm) {
    DOM.contactForm.addEventListener("submit", handleContactSubmit);
  }
}

function initSubscriptions() {
  subscribe((next, prev) => {
    if (next.theme !== prev.theme) {
      applyTheme(next.theme);
    }
    if (next.navOpen !== prev.navOpen) {
      renderNav(next.navOpen);
    }
    if (next.session !== prev.session || next.profile !== prev.profile) {
      renderUserStatus(next);
      if (!next.session) {
        setTurns([]);
      }
    }
    if (next.treatments !== prev.treatments || next.professionals !== prev.professionals) {
      renderCatalog(next);
    }
    if (next.upcomingTurns !== prev.upcomingTurns) {
      renderNextTurns(next);
    }
    if (next.turns !== prev.turns) {
      renderTurnsTable(next);
    }
    if (next.chatOpen !== prev.chatOpen) {
      renderChat(next);
    }
  });
}

async function bootstrapSupabase() {
  try {
    updateStatus("auth", "loading");
    const session = await getCurrentSession();
    let profile = null;
    if (session) {
      profile = await ensureProfile(session);
    }
    setState({
      session,
      profile,
      status: { ...getState().status, auth: "idle" },
    });
    await refreshCatalogData();
    await syncClientTurns();
    listenAuthEvents();
    listenTurnsRealtime();
  } catch (error) {
    console.error("No fue posible conectar con Supabase.", error);
    updateStatus("auth", "error");
    showToast({
      title: "Supabase sin conexión",
      description: "Seguís en modo demo. Revisá la configuración si necesitás datos en vivo.",
      variant: "error",
    });
  }
}

function informSupabaseUnavailable() {
  showToast({
    title: "Modo demostración",
    description: "Supabase no está inicializado. Se utilizarán datos locales.",
    variant: "warning",
    timeout: 6000,
  });
}

function handleGlobalClick(event) {
  const actionable = event.target.closest("[data-action]");
  if (!actionable) return;
  const { action, id } = actionable.dataset;

  switch (action) {
    case "scroll-top":
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "toggle-nav":
      event.preventDefault();
      updateState((state) => ({ ...state, navOpen: !state.navOpen }));
      break;
    case "close-nav":
      updateState((state) => ({ ...state, navOpen: false }));
      break;
    case "toggle-theme":
      toggleTheme();
      break;
    case "open-turn-modal":
      openTurnModal();
      break;
    case "close-modal":
      closeModal();
      break;
    case "view-treatment":
      viewTreatment(id);
      break;
    case "request-turn":
      openTurnModal({ treatmentId: id });
      break;
    case "open-auth":
      openLoginModal();
      break;
    case "close-login":
      closeLoginModal();
      break;
    case "logout":
      signOut();
      break;
    case "show-treatments":
      scrollToSection("tratamientos");
      break;
    case "show-my-turns":
      showMyTurns();
      break;
    case "show-history":
      openHistoryModal();
      break;
    case "reprogram-turn":
      reprogramTurn(id);
      break;
    case "cancel-turn":
      cancelTurn(id);
      break;
    case "view-turn":
      viewTurnDetails(id);
      break;
    case "chat-open":
      setState({ chatOpen: true });
      break;
    case "chat-close":
      setState({ chatOpen: false });
      break;
    case "chat-quick":
      sendChatQuick(actionable.dataset.value);
      break;
    default:
      break;
  }
}

function handleGlobalSubmit(event) {
  const form = event.target.closest("form");
  if (!form) return;
  const { formId } = form.dataset;
  if (formId === "turn-request") {
    event.preventDefault();
    handleTurnFormSubmit(form);
  }
  if (formId === "login") {
    event.preventDefault();
    handleLoginSubmit(form);
  }
  if (formId === "chat") {
    event.preventDefault();
    handleChatSubmit(form);
  }
}

function handleTreatmentSearch() {
  treatmentQuery = (DOM.treatmentSearchInput?.value || "").trim().toLowerCase();
  renderCatalog(getState());
}

function handleLanguageChange(event) {
  const value = event.target.value;
  if (value === "en") {
    showToast({
      title: "Traducción en progreso",
      description: "Estamos preparando la versión en inglés. Por ahora, mantenemos el contenido en español.",
      variant: "info",
    });
  }
}

function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const name = formData.get("name");
  showToast({
    title: "Consulta enviada",
    description: `Gracias ${name || ""}. Te contactaremos por correo en menos de 24 hs.`,
    variant: "success",
  });
  form.reset();
}

function applyTheme(theme) {
  DOM.body.dataset.theme = theme;
  persistTheme(theme);
  if (DOM.themeToggle) {
    DOM.themeToggle.setAttribute("aria-label", `Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`);
  }
}

function toggleTheme() {
  const nextTheme = getState().theme === "dark" ? "light" : "dark";
  setState({ theme: nextTheme });
}

function renderNav(open) {
  if (!DOM.navMenu) return;
  DOM.navMenu.dataset.open = String(open);
  if (!open && DOM.navToggle) {
    DOM.navToggle.setAttribute("aria-expanded", "false");
  }
  if (open && DOM.navToggle) {
    DOM.navToggle.setAttribute("aria-expanded", "true");
  }
}

function renderCatalog(state) {
  const treatmentsSource = state.treatments?.length ? state.treatments : FALLBACK_TREATMENTS;
  const professionalsSource = state.professionals?.length ? state.professionals : FALLBACK_PROFESSIONALS;
  const filteredTreatments = !treatmentQuery
    ? treatmentsSource
    : treatmentsSource.filter((item) => {
        const search = treatmentQuery;
        return (
          (item.name || "").toLowerCase().includes(search) ||
          (item.spec || item.specialty || "").toLowerCase().includes(search)
        );
      });

  renderTreatments(filteredTreatments);
  renderProfessionals(professionalsSource);
}

function renderTreatments(list) {
  if (!DOM.treatmentsGrid) return;
  if (!Array.isArray(list) || !list.length) {
    DOM.treatmentsGrid.innerHTML = `<div class="card text-muted">No encontramos tratamientos con ese criterio.</div>`;
    return;
  }
  DOM.treatmentsGrid.innerHTML = list
    .map((treatment) => {
      const id = treatment.id ?? treatment.name ?? "";
      const name = treatment.name ?? "Tratamiento";
      const specialty = treatment.spec ?? treatment.specialty ?? "Especialidad a confirmar";
      const image =
        treatment.img ??
        treatment.image_url ??
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3";
      const description = treatment.description ?? "Solicitá una evaluación personalizada para conocer más detalles.";
      return `
        <article class="card treatment-card" data-id="${id}">
          <img src="${image}" alt="${name}" loading="lazy">
          <h3>${name}</h3>
          <p class="text-muted">${specialty}</p>
          <p class="text-muted" style="font-size:0.9rem;">${description}</p>
          <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn--ghost" data-action="view-treatment" data-id="${id}">Ver detalles</button>
            <button class="btn btn--solid" data-action="request-turn" data-id="${id}">Reservar turno</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderProfessionals(list) {
  if (!DOM.professionalsGrid) return;
  if (!Array.isArray(list) || !list.length) {
    DOM.professionalsGrid.innerHTML = `<div class="card text-muted">Todavía no publicamos profesionales.</div>`;
    return;
  }
  DOM.professionalsGrid.innerHTML = list
    .map((professional) => {
      const id = professional.id ?? professional.name ?? "";
      const name = professional.name ?? "Profesional";
      const specialty = professional.spec ?? professional.specialty ?? "Especialidad a confirmar";
      const bio = professional.bio ?? professional.description ?? "Consultá para más información.";
      return `
        <article class="card" data-id="${id}">
          <h3>${name}</h3>
          <p class="text-muted" style="margin-bottom:6px;">${specialty}</p>
          <p class="text-muted" style="font-size:0.92rem;">${bio}</p>
          <div style="margin-top:16px;text-align:right;">
            <button class="btn btn--tonal" data-action="open-turn-modal" data-professional="${name}">Agendar consulta</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNextTurns(state) {
  if (!DOM.nextTurns) return;
  const session = state.session;
  if (!hasSupabase()) {
    DOM.nextTurns.innerHTML = `
      <div class="card text-muted">
        Conectá Supabase para ver turnos en vivo. Mientras tanto, utilizá el modo demo.
      </div>
    `;
    return;
  }
  if (!session) {
    DOM.nextTurns.innerHTML = `
      <div class="card text-muted">${FALLBACK_TURN_MESSAGE}</div>
    `;
    return;
  }
  const list = state.upcomingTurns ?? [];
  if (!list.length) {
    DOM.nextTurns.innerHTML = `
      <div class="card text-muted">No registrás turnos próximos. Reservá uno para verlo aquí mismo.</div>
    `;
    return;
  }
  DOM.nextTurns.innerHTML = list
    .map(
      (turn) => `
        <article class="card" style="display:grid;gap:6px;">
          <strong>${turn.specialty} — ${turn.professional || "Profesional a asignar"}</strong>
          <span class="text-muted">${turn.date} • ${turn.time} • ${turn.type}</span>
        </article>
      `,
    )
    .join("");
}

function renderTurnsTable(state) {
  if (!DOM.turnsTable) return;
  if (!hasSupabase()) {
    DOM.turnsTable.innerHTML = `
      <div class="card text-muted">
        Activá Supabase para gestionar turnos reales desde aquí.
      </div>
    `;
    return;
  }
  if (!state.session) {
    DOM.turnsTable.innerHTML = `
      <div class="card text-muted">
        Iniciá sesión para ver y administrar tus turnos reservados.
      </div>
    `;
    return;
  }
  const turns = state.turns ?? [];
  if (!turns.length) {
    DOM.turnsTable.innerHTML = `
      <div class="card text-muted">
        Todavía no tenés turnos cargados. Reservá uno para comenzar.
      </div>
    `;
    return;
  }
  DOM.turnsTable.innerHTML = `
    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Médico</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th style="width:180px;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${turns
            .map((turn) => {
              return `
                <tr data-id="${turn.id}">
                  <td>${turn.date}</td>
                  <td>${turn.time}</td>
                  <td>${turn.professional || "-"}</td>
                  <td>${turn.type}</td>
                  <td>${statusPill(turn.status)}</td>
                  <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn--ghost" data-action="reprogram-turn" data-id="${turn.id}">Reprogramar</button>
                    <button class="btn btn--ghost" data-action="cancel-turn" data-id="${turn.id}">Cancelar</button>
                    <button class="btn btn--ghost" data-action="view-turn" data-id="${turn.id}">Detalle</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserStatus(state) {
  if (!DOM.userStatus || !DOM.loginBtn) return;
  const session = state.session;
  if (!session) {
    DOM.userStatus.innerHTML = "";
    DOM.loginBtn.hidden = false;
    if (DOM.adminLink) {
      DOM.adminLink.hidden = true;
    }
    return;
  }
  const profile = state.profile;
  const displayName =
    profile?.full_name ||
    session.user?.user_metadata?.full_name ||
    (session.user?.email ? session.user.email.split("@")[0] : "Usuario");
  DOM.userStatus.innerHTML = `
    Bienvenido, <strong>${displayName}</strong>
    <button class="btn btn--ghost" data-action="logout" style="margin-left:8px;">Cerrar sesión</button>
  `;
  DOM.loginBtn.hidden = true;
  if (DOM.adminLink) {
    DOM.adminLink.hidden = !(profile && profile.role === "admin");
  }
}

function renderChat(state) {
  if (!DOM.chatRoot) return;
  if (!state.chatOpen) {
    DOM.chatRoot.innerHTML = `
      <button class="chat-launcher" data-action="chat-open" aria-label="Abrir chat de asistencia">💬</button>
    `;
    return;
  }

  const history = chatHistory.length
    ? chatHistory
    : [{ author: "bot", text: "Hola 👋 Soy el asistente virtual de Clínica Moguz. ¿En qué puedo ayudarte?" }];

  DOM.chatRoot.innerHTML = `
    <section class="chat-window" role="dialog" aria-label="Asistente virtual">
      <header>
        <span>Asistente Clínica Moguz</span>
        <button class="btn btn--icon" data-action="chat-close" aria-label="Cerrar chat">✕</button>
      </header>
      <div class="chat-log">
        ${history
          .map((msg) => `<div class="msg ${msg.author === "user" ? "msg--user" : "msg--bot"}">${msg.text}</div>`)
          .join("")}
      </div>
      <div class="quick-buttons">
        <button class="btn btn--ghost" data-action="chat-quick" data-value="Consultar turnos">Consultar turnos</button>
        <button class="btn btn--ghost" data-action="chat-quick" data-value="Ver tratamientos">Ver tratamientos</button>
        <button class="btn btn--ghost" data-action="chat-quick" data-value="Horarios y contacto">Horarios y contacto</button>
      </div>
      <form data-form-id="chat" class="chat-form">
        <label class="sr-only" for="chat-input">Escribí tu consulta</label>
        <input id="chat-input" name="message" placeholder="Escribí tu consulta" autocomplete="off">
      </form>
    </section>
  `;
  const log = DOM.chatRoot.querySelector(".chat-log");
  if (log) {
    log.scrollTop = log.scrollHeight;
  }
}

function statusPill(status) {
  const normalized = (status || "pendiente").toLowerCase();
  const className =
    normalized === "confirmado" ? "pill--confirmed" : normalized === "cancelado" ? "pill--cancelled" : "pill--pending";
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `<span class="pill ${className}">${label}</span>`;
}

function viewTreatment(identifier) {
  const treatments = getState().treatments?.length ? getState().treatments : FALLBACK_TREATMENTS;
  const treatment = treatments.find((item) => normalizeId(item.id) === normalizeId(identifier) || item.name === identifier);
  if (!treatment) {
    showToast({
      title: "Tratamiento no disponible",
      description: "No encontramos información para el tratamiento seleccionado.",
      variant: "error",
    });
    return;
  }
  const name = treatment.name ?? "Tratamiento";
  const specialty = treatment.spec ?? treatment.specialty ?? "Especialidad a confirmar";
  const duration = treatment.duration ?? "Duración estimada a confirmar con el profesional.";
  const description =
    treatment.description ?? "Solicitá una evaluación personalizada para recibir un plan de tratamiento detallado.";
  showModal({
    title: name,
    body: `
      <p><strong>Especialidad:</strong> ${specialty}</p>
      <p><strong>Duración estimada:</strong> ${duration}</p>
      <p>${description}</p>
      <div style="margin-top:24px;text-align:right;">
        <button class="btn btn--solid" data-action="open-turn-modal" data-treatment-name="${name}">Reservar consulta</button>
      </div>
    `,
  });
}

function openTurnModal(options = {}) {
  if (!hasSupabase()) {
    showToast({
      title: "Función no disponible",
      description: "Activá Supabase para solicitar turnos reales. En modo demo solo podés explorar la interfaz.",
      variant: "error",
    });
    return;
  }
  if (!getState().session) {
    openLoginModal();
    showToast({
      title: "Necesitás iniciar sesión",
      description: "Iniciá sesión para reservar un turno y recibir confirmaciones por correo.",
      variant: "info",
    });
    return;
  }

  const professionals = getState().professionals?.length ? getState().professionals : FALLBACK_PROFESSIONALS;
  const treatments = getState().treatments?.length ? getState().treatments : FALLBACK_TREATMENTS;
  let specialtyPref = options.specialty ?? "";
  if (!specialtyPref && options.treatmentId) {
    const treatment = treatments.find(
      (item) => normalizeId(item.id) === normalizeId(options.treatmentId) || item.name === options.treatmentId,
    );
    specialtyPref = treatment?.spec ?? treatment?.specialty ?? "";
  }

  const modalId = `turn-modal-${Date.now()}`;
  DOM.modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <article class="modal" role="dialog" aria-modal="true" aria-labelledby="${modalId}">
        <div class="modal__header">
          <div>
            <h3 id="${modalId}" style="margin:0;">Solicitar turno</h3>
            <p class="text-muted" style="margin:4px 0 0 0;">Elegí fecha, modalidad y profesional en segundos.</p>
          </div>
          <button class="btn btn--icon" data-action="close-modal" aria-label="Cerrar">✕</button>
        </div>
        <form data-form-id="turn-request">
          <div class="form-row form-row--split">
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Modalidad</span>
              <select name="type" required>
                <option value="Presencial">Presencial</option>
                <option value="Virtual">Virtual</option>
              </select>
            </label>
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Especialidad</span>
              <select name="specialty" required>
                <option value="Cirugía Plástica">Cirugía Plástica</option>
                <option value="Cirugía Reconstructiva">Cirugía Reconstructiva</option>
                <option value="Estética">Estética</option>
              </select>
            </label>
          </div>
          <div class="form-row form-row--split">
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Profesional (opcional)</span>
              <select name="professional">
                <option value="">Cualquier profesional disponible</option>
                ${professionals
                  .map(
                    (pro) =>
                      `<option value="${pro.name}" ${options.professional === pro.name ? "selected" : ""}>${pro.name} — ${
                        pro.spec ?? pro.specialty ?? ""
                      }</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Paciente</span>
              <input name="patient" placeholder="Nombre y apellido" required value="${options.patient ?? ""}">
            </label>
          </div>
          <div class="form-row form-row--split">
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Fecha</span>
              <input name="date" type="date" required value="${options.date ?? ""}">
            </label>
            <label>
              <span class="text-muted" style="font-size:0.85rem;">Hora</span>
              <input name="time" type="time" required value="${options.time ?? ""}">
            </label>
          </div>
          <p class="helper-text">Recordá que podés reprogramar o cancelar desde “Mis turnos”.</p>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-action="close-modal" type="button">Cancelar</button>
            <button class="btn btn--solid" type="submit">${options.mode === "edit" ? "Guardar cambios" : "Confirmar turno"}</button>
          </div>
        </form>
      </article>
    </div>
  `;
  const backdrop = DOM.modalRoot.querySelector(".modal-backdrop");
  const specialtySelect = DOM.modalRoot.querySelector("select[name='specialty']");
  if (specialtyPref) {
    const exists = Array.from(specialtySelect.options).some((option) => option.value === specialtyPref);
    if (!exists) {
      const option = document.createElement("option");
      option.value = specialtyPref;
      option.textContent = specialtyPref;
      specialtySelect.appendChild(option);
    }
    specialtySelect.value = specialtyPref;
  }
  if (backdrop) {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop || event.target.dataset.action === "close-modal") {
        closeModal();
      }
    });
  }
  if (options.turnId) {
    DOM.modalRoot.querySelector("form").dataset.turnId = options.turnId;
  }
}

function closeModal() {
  DOM.modalRoot.innerHTML = "";
}

async function handleTurnFormSubmit(form) {
  const formData = new FormData(form);
  const payload = {
    type: formData.get("type"),
    specialty: formData.get("specialty"),
    professional: formData.get("professional") || null,
    patient: formData.get("patient"),
    date: formData.get("date"),
    time: formData.get("time"),
  };
  const turnId = form.dataset.turnId;
  const session = getState().session;
  if (!session) {
    showToast({
      title: "Sesión expirada",
      description: "Volvé a iniciar sesión para continuar.",
      variant: "error",
    });
    return;
  }
  try {
    if (turnId) {
      await updateTurn(turnId, payload);
      showToast({ title: "Turno actualizado", description: "Actualizamos la reserva correctamente.", variant: "success" });
    } else {
      await saveTurn({ ...payload, status: "pendiente", user_id: session.user.id });
      showToast({ title: "Turno reservado", description: "Te enviaremos la confirmación por correo.", variant: "success" });
    }
    closeModal();
    await syncClientTurns();
  } catch (error) {
    console.error("Error gestionando el turno:", error);
    showToast({
      title: "No pudimos guardar el turno",
      description: error?.message ?? "Intentá nuevamente en unos minutos.",
      variant: "error",
    });
  }
}

async function reprogramTurn(id) {
  await syncClientTurns();
  const turns = getState().turns ?? [];
  const turn = turns.find((item) => normalizeId(item.id) === normalizeId(id));
  if (!turn) {
    showToast({
      title: "Turno no encontrado",
      description: "No encontramos el turno seleccionado.",
      variant: "error",
    });
    return;
  }
  openTurnModal({
    mode: "edit",
    turnId: turn.id,
    type: turn.type,
    specialty: turn.specialty,
    professional: turn.professional || "",
    date: turn.date,
    time: turn.time,
    patient: turn.patient,
  });
}

async function cancelTurn(id) {
  if (!window.confirm("¿Confirmás la cancelación del turno?")) return;
  try {
    await updateTurn(id, { status: "cancelado" });
    showToast({ title: "Turno cancelado", description: "Marcamos el turno como cancelado.", variant: "success" });
    await syncClientTurns();
  } catch (error) {
    console.error("Error cancelando turno", error);
    showToast({
      title: "No pudimos cancelar",
      description: error?.message ?? "Reintentá en unos segundos.",
      variant: "error",
    });
  }
}

async function viewTurnDetails(id) {
  await syncClientTurns();
  const turn = (getState().turns ?? []).find((item) => normalizeId(item.id) === normalizeId(id));
  if (!turn) {
    showToast({
      title: "Sin detalle",
      description: "El turno seleccionado ya no está disponible.",
      variant: "warning",
    });
    return;
  }
  showModal({
    title: "Detalle del turno",
    body: `
      <div class="insights">
        <div class="insight">
          <span class="text-muted">Fecha y hora</span>
          <strong>${turn.date} — ${turn.time}</strong>
        </div>
        <div class="insight">
          <span class="text-muted">Especialidad</span>
          <strong>${turn.specialty}</strong>
        </div>
        <div class="insight">
          <span class="text-muted">Profesional</span>
          <strong>${turn.professional || "Por asignar"}</strong>
        </div>
        <div class="insight">
          <span class="text-muted">Paciente</span>
          <strong>${turn.patient}</strong>
        </div>
        <div class="insight">
          <span class="text-muted">Estado</span>
          ${statusPill(turn.status)}
        </div>
      </div>
    `,
  });
}

function showMyTurns() {
  renderTurnsTable(getState());
  scrollToSection("turnos");
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  window.scrollTo({
    top: target.offsetTop - 80,
    behavior: "smooth",
  });
}

function openHistoryModal() {
  const turns = getState().turns ?? [];
  if (!turns.length) {
    showToast({
      title: "Sin historial",
      description: "Aún no registrás turnos en tu cuenta.",
      variant: "info",
    });
    return;
  }
  const historyItems = turns
    .map((turn) => `<li>${turn.date} ${turn.time} — ${turn.specialty} — ${turn.status}</li>`)
    .join("");
  showModal({
    title: "Historial de turnos",
    body: `<ul style="margin:0;padding-left:20px;">${historyItems}</ul>`,
  });
}

function showModal({ title, body }) {
  const modalId = `modal-${Date.now()}`;
  DOM.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <article class="modal" role="dialog" aria-modal="true" aria-labelledby="${modalId}">
        <div class="modal__header">
          <h3 id="${modalId}" style="margin:0;">${title}</h3>
          <button class="btn btn--icon" data-action="close-modal" aria-label="Cerrar">✕</button>
        </div>
        <div>${body}</div>
      </article>
    </div>
  `;
  const backdrop = DOM.modalRoot.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop || event.target.dataset.action === "close-modal") {
        closeModal();
      }
    });
  }
}

function openLoginModal() {
  const supabase = getSupabaseClient();
  DOM.loginModalRoot.innerHTML = `
    <div class="modal-backdrop">
      <article class="modal" style="max-width:420px;" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div class="modal__header">
          <h3 id="login-title" style="margin:0;">Iniciar sesión</h3>
          <button class="btn btn--icon" data-action="close-login" aria-label="Cerrar">✕</button>
        </div>
        <p class="text-muted">
          Ingresá tu correo y te enviaremos un enlace mágico para acceder al instante.
        </p>
        <form data-form-id="login">
          <label>
            <span class="text-muted" style="font-size:0.85rem;">Correo electrónico</span>
            <input type="email" name="email" placeholder="tucorreo@ejemplo.com" required>
          </label>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-action="close-login" type="button">Cancelar</button>
            <button class="btn btn--solid" type="submit">Enviar enlace</button>
          </div>
        </form>
        ${
          supabase
            ? ""
            : `<div class="card text-muted" style="margin-top:-8px;">
                La autenticación real requiere Supabase activo. En modo demo podés explorar sin iniciar sesión.
              </div>`
        }
      </article>
    </div>
  `;
  const backdrop = DOM.loginModalRoot.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop || event.target.dataset.action === "close-login") {
        closeLoginModal();
      }
    });
  }
}

function closeLoginModal() {
  DOM.loginModalRoot.innerHTML = "";
}

async function handleLoginSubmit(form) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    showToast({
      title: "Autenticación no disponible",
      description: "Configura Supabase para enviar enlaces mágicos.",
      variant: "warning",
    });
    return;
  }
  const email = form.email.value.trim();
  if (!email) return;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    showToast({
      title: "Revisá tu correo",
      description: `Enviamos un enlace mágico a ${email}. Revisá tu bandeja (y spam).`,
      variant: "success",
    });
    closeLoginModal();
  } catch (error) {
    console.error("Error enviando magic link:", error);
    showToast({
      title: "No pudimos enviar el enlace",
      description: error?.message ?? "Probá nuevamente en unos minutos.",
      variant: "error",
    });
  }
}

async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    setState({ session: null, profile: null });
    return;
  }
  await supabase.auth.signOut();
}

async function refreshCatalogData() {
  try {
    updateStatus("treatments", "loading");
    updateStatus("professionals", "loading");
    const [treatments, professionals] = await Promise.all([fetchTreatments(), fetchProfessionals()]);
    if (treatments?.length) {
      setState({ treatments });
    }
    if (professionals?.length) {
      setState({ professionals });
    }
    updateStatus("treatments", "idle");
    updateStatus("professionals", "idle");
  } catch (error) {
    console.error("Error cargando catálogo:", error);
    updateStatus("treatments", "error");
    updateStatus("professionals", "error");
  }
}

async function syncClientTurns() {
  if (!hasSupabase()) return;
  const session = getState().session;
  if (!session) {
    setTurns([]);
    return;
  }
  try {
    updateStatus("turns", "loading");
    const list = await fetchClientTurns(session);
    setTurns(list);
    updateStatus("turns", "idle");
  } catch (error) {
    console.error("Error obteniendo turnos del cliente:", error);
    updateStatus("turns", "error");
    showToast({
      title: "No pudimos sincronizar tus turnos",
      description: "Intentá refrescar la página o reintentar en unos minutos.",
      variant: "error",
    });
  }
}

function setTurns(turns) {
  const upcoming = (turns ?? [])
    .filter((turn) => (turn.status || "pendiente") !== "cancelado")
    .slice(0, 3);
  setState({ turns: turns ?? [], upcomingTurns: upcoming });
}

function updateStatus(key, value) {
  const current = getState().status ?? {};
  setState({ status: { ...current, [key]: value } });
}

function listenAuthEvents() {
  onAuthChange(async (session) => {
    if (session) {
      const profile = await ensureProfile(session);
      setState({ session, profile });
      await syncClientTurns();
    } else {
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        realtimeUnsubscribe = null;
      }
      setState({ session: null, profile: null });
    }
  });
}

function listenTurnsRealtime() {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
  }
  realtimeUnsubscribe = onTurnsRealtime(async () => {
    await syncClientTurns();
  });
}

function handleChatSubmit(form) {
  const value = form.message.value.trim();
  if (!value) return;
  pushChatMessage({ author: "user", text: value });
  form.reset();
  setTimeout(() => botReply(value), 400);
}

function sendChatQuick(value) {
  pushChatMessage({ author: "user", text: value });
  setTimeout(() => botReply(value), 300);
}

function pushChatMessage(message) {
  chatHistory.push(message);
  renderChat(getState());
}

async function botReply(message) {
  const lower = message.toLowerCase();
  if (/(turnos|turno|cita)/.test(lower)) {
    if (!getState().session) {
      pushChatMessage({
        author: "bot",
        text: "Iniciá sesión para solicitar y revisar tus turnos. Podés hacerlo desde el botón “Iniciar sesión” en la barra superior.",
      });
      return;
    }
    const turns = getState().turns ?? [];
    pushChatMessage({
      author: "bot",
      text: turns.length
        ? `Tenés ${turns.length} turno(s) registrado(s). Usá “Mis turnos” para gestionarlos.`
        : "Todavía no registrás turnos. Reservá uno desde “Solicitar turno”.",
    });
    return;
  }
  if (/(tratamiento|estética|rinoplast|lipo)/.test(lower)) {
    pushChatMessage({
      author: "bot",
      text: "Visitá la sección Tratamientos para ver procedimientos destacados. Podés reservar un turno directamente desde cada tarjeta.",
    });
    return;
  }
  if (/(horario|contacto|tel|teléfono|telefono)/.test(lower)) {
    pushChatMessage({
      author: "bot",
      text: "Horarios: Lun a Mié de 08:00 a 20:00. Tel: (+54) 9 11 5754-2448. Instagram: @moguz6040. Dirección: España 1115, Corrientes.",
    });
    return;
  }
  pushChatMessage({
    author: "bot",
    text: "No estoy seguro de haber entendido. ¿Querés que derivemos tu consulta a un asistente humano?",
  });
}

function normalizeId(value) {
  return value !== null && value !== undefined ? String(value) : "";
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    closeModal();
    closeLoginModal();
  }
}

document.addEventListener("keydown", handleGlobalKeydown);

