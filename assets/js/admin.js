import {
  hasSupabase,
  getSupabaseClient,
  getCurrentSession,
  ensureProfile,
  fetchTurnsWithFilters,
  fetchProfessionals,
  fetchTreatments,
  updateTurn,
  deleteTurn,
  onTurnsRealtime,
} from "./services/supabaseClient.js";
import { showToast } from "./ui/feedback.js";

const STORAGE_THEME_KEY = "cm-theme";

const DOM = {};
const state = {
  session: null,
  profile: null,
  filters: {
    status: "",
    from: "",
    to: "",
  },
  turns: [],
  professionals: [],
  treatments: [],
};

let realtimeUnsubscribe = null;

init();

function init() {
  cacheDom();
  applySavedTheme();
  bindEvents();
  bootstrap();
}

function cacheDom() {
  DOM.body = document.body;
  DOM.authGuard = document.getElementById("auth-guard");
  DOM.guardMessage = document.getElementById("guard-message");
  DOM.sendLinkBtn = document.getElementById("send-link-btn");
  DOM.content = document.getElementById("content");
  DOM.summaryTurns = document.getElementById("summary-turns");
  DOM.summaryPending = document.getElementById("summary-pending");
  DOM.summaryPros = document.getElementById("summary-pros");
  DOM.filterStatus = document.getElementById("filter-status");
  DOM.filterFrom = document.getElementById("filter-from");
  DOM.filterTo = document.getElementById("filter-to");
  DOM.turnsTableBody = document.getElementById("turns-table-body");
  DOM.refreshTurnsBtn = document.getElementById("refresh-turns");
  DOM.resetFiltersBtn = document.getElementById("reset-filters");
  DOM.prosList = document.getElementById("pros-list");
  DOM.treatmentsList = document.getElementById("treatments-list");
  DOM.refreshProsBtn = document.getElementById("refresh-pros");
  DOM.refreshTreatmentsBtn = document.getElementById("refresh-treatments");
  DOM.logoutBtn = document.getElementById("logout-btn");
  DOM.themeToggle = document.getElementById("theme-toggle");
  DOM.toastRoot = document.getElementById("toast-root");
}

function bindEvents() {
  DOM.filterStatus?.addEventListener("change", handleFilterChange);
  DOM.filterFrom?.addEventListener("change", handleFilterChange);
  DOM.filterTo?.addEventListener("change", handleFilterChange);
  DOM.refreshTurnsBtn?.addEventListener("click", () => loadTurns());
  DOM.resetFiltersBtn?.addEventListener("click", resetFilters);
  DOM.refreshProsBtn?.addEventListener("click", () => loadProfessionals(true));
  DOM.refreshTreatmentsBtn?.addEventListener("click", () => loadTreatments(true));
  DOM.logoutBtn?.addEventListener("click", handleLogout);
  DOM.themeToggle?.addEventListener("click", toggleTheme);
  DOM.sendLinkBtn?.addEventListener("click", sendMagicLink);
  document.querySelector("[data-action='retry-session']")?.addEventListener("click", bootstrap);

  DOM.turnsTableBody?.addEventListener("change", handleTableChange);
  DOM.turnsTableBody?.addEventListener("click", handleTableClick);
}

async function bootstrap() {
  if (!hasSupabase()) {
    showGuard("Supabase no está disponible. Revisá la configuración de claves.", false);
    return;
  }
  hideGuard();
  const allowed = await ensureAdminAccess();
  if (!allowed) return;
  await Promise.all([loadProfessionals(), loadTreatments(), loadTurns()]);
  listenRealtime();
}

async function ensureAdminAccess() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      showGuard("Necesitás iniciar sesión como administrador para ingresar al panel.", true);
      return false;
    }
    const profile = await ensureProfile(session);
    if (!profile || profile.role !== "admin") {
      showGuard("Tu usuario no cuenta con permisos administrativos. Contactá al responsable de la clínica.", false);
      return false;
    }
    state.session = session;
    state.profile = profile;
    showContent();
    return true;
  } catch (error) {
    console.error("Error validando acceso administrativo:", error);
    showGuard("No pudimos validar tus credenciales. Reintentá en unos minutos.", true);
    return false;
  }
}

function showGuard(message, allowLogin) {
  if (DOM.guardMessage) {
    DOM.guardMessage.textContent = message;
  }
  DOM.authGuard?.removeAttribute("hidden");
  DOM.content?.setAttribute("hidden", "true");
  if (DOM.sendLinkBtn) {
    DOM.sendLinkBtn.hidden = !allowLogin;
  }
}

function hideGuard() {
  DOM.authGuard?.setAttribute("hidden", "true");
}

function showContent() {
  hideGuard();
  DOM.content?.removeAttribute("hidden");
}

async function loadTurns() {
  if (!state.session) return;
  try {
    const filters = { ...state.filters };
    const turns = await fetchTurnsWithFilters(filters);
    state.turns = turns;
    renderTurns();
    renderSummary();
  } catch (error) {
    console.error("Error cargando turnos:", error);
    showToast({
      title: "No pudimos cargar los turnos",
      description: error?.message ?? "Intentá nuevamente en unos minutos.",
      variant: "error",
    });
  }
}

async function loadProfessionals(withFeedback = false) {
  try {
    const list = await fetchProfessionals();
    state.professionals = list;
    renderProfessionals();
    renderSummary();
    if (withFeedback) {
      showToast({ title: "Profesionales actualizados", description: "Información sincronizada desde Supabase.", variant: "success" });
    }
  } catch (error) {
    console.error("Error cargando profesionales:", error);
    DOM.prosList.innerHTML = `<div class="text-muted">No se pudieron cargar los profesionales. ${error?.message ?? ""}</div>`;
  }
}

async function loadTreatments(withFeedback = false) {
  try {
    const list = await fetchTreatments();
    state.treatments = list;
    renderTreatments();
    if (withFeedback) {
      showToast({ title: "Tratamientos actualizados", description: "Catálogo sincronizado correctamente.", variant: "success" });
    }
  } catch (error) {
    console.error("Error cargando tratamientos:", error);
    DOM.treatmentsList.innerHTML = `<div class="text-muted">No se pudieron cargar los tratamientos. ${error?.message ?? ""}</div>`;
  }
}

function renderTurns() {
  if (!DOM.turnsTableBody) return;
  const turns = state.turns ?? [];
  if (!turns.length) {
    DOM.turnsTableBody.innerHTML = `<tr><td colspan="7" class="text-muted">No hay turnos con los filtros seleccionados.</td></tr>`;
    return;
  }
  const professionalOptions = buildProfessionalOptions();
  DOM.turnsTableBody.innerHTML = turns
    .map((turn) => {
      const professionalSelect = professionalOptions.replace(
        `value="${turn.professional || ""}"`,
        `value="${turn.professional || ""}" selected`,
      );
      return `
        <tr data-id="${turn.id}">
          <td>${turn.date}</td>
          <td>${turn.time}</td>
          <td>${turn.patient}</td>
          <td>${turn.type}</td>
          <td>
            <select data-action="assign-professional" data-id="${turn.id}">
              ${professionalSelect}
            </select>
          </td>
          <td>
            <select data-action="set-status" data-id="${turn.id}">
              <option value="pendiente"${turn.status === "pendiente" ? " selected" : ""}>Pendiente</option>
              <option value="confirmado"${turn.status === "confirmado" ? " selected" : ""}>Confirmado</option>
              <option value="cancelado"${turn.status === "cancelado" ? " selected" : ""}>Cancelado</option>
            </select>
          </td>
          <td style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn--ghost" data-action="view-turn" data-id="${turn.id}">Ver</button>
            <button class="btn btn--ghost" data-action="delete-turn" data-id="${turn.id}" style="color:#dc2626;border-color:rgba(220,38,38,0.4);">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSummary() {
  const turns = state.turns ?? [];
  const pending = turns.filter((turn) => turn.status === "pendiente").length;
  DOM.summaryTurns.textContent = turns.length;
  DOM.summaryPending.textContent = pending;
  DOM.summaryPros.textContent = state.professionals?.length ?? 0;
}

function renderProfessionals() {
  if (!DOM.prosList) return;
  const list = state.professionals ?? [];
  if (!list.length) {
    DOM.prosList.innerHTML = `<div class="text-muted">No hay profesionales cargados en Supabase.</div>`;
    return;
  }
  DOM.prosList.innerHTML = list
    .map(
      (pro) => `
        <div class="list-panel__item">
          <strong>${pro.name}</strong><br>
          <span class="text-muted">${pro.specialty}</span><br>
          <span class="text-muted">${pro.bio || ""}</span>
        </div>
      `,
    )
    .join("");
}

function renderTreatments() {
  if (!DOM.treatmentsList) return;
  const list = state.treatments ?? [];
  if (!list.length) {
    DOM.treatmentsList.innerHTML = `<div class="text-muted">No hay tratamientos publicados.</div>`;
    return;
  }
  DOM.treatmentsList.innerHTML = list
    .map(
      (treatment) => `
        <div class="list-panel__item">
          <strong>${treatment.name}</strong><br>
          <span class="text-muted">${treatment.specialty}</span>
        </div>
      `,
    )
    .join("");
}

function buildProfessionalOptions() {
  const base = ['<option value="">Sin asignar</option>'];
  (state.professionals ?? []).forEach((pro) => {
    base.push(`<option value="${pro.name}">${pro.name} — ${pro.specialty}</option>`);
  });
  return base.join("");
}

function handleFilterChange() {
  state.filters.status = DOM.filterStatus?.value ?? "";
  state.filters.from = DOM.filterFrom?.value ?? "";
  state.filters.to = DOM.filterTo?.value ?? "";
}

function resetFilters() {
  if (DOM.filterStatus) DOM.filterStatus.value = "";
  if (DOM.filterFrom) DOM.filterFrom.value = "";
  if (DOM.filterTo) DOM.filterTo.value = "";
  state.filters = { status: "", from: "", to: "" };
  loadTurns();
}

async function handleTableChange(event) {
  const target = event.target;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;
  try {
    if (action === "assign-professional") {
      await updateTurn(id, { professional: target.value || null });
      showToast({ title: "Profesional asignado", description: "Actualizamos el turno correctamente.", variant: "success" });
    }
    if (action === "set-status") {
      await updateTurn(id, { status: target.value });
      showToast({ title: "Estado actualizado", description: "El estado del turno fue modificado.", variant: "success" });
    }
    await loadTurns();
  } catch (error) {
    console.error("Error actualizando el turno:", error);
    showToast({
      title: "No pudimos guardar los cambios",
      description: error?.message ?? "Intentá nuevamente en unos segundos.",
      variant: "error",
    });
  }
}

async function handleTableClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id } = target.dataset;
  if (!id) return;
  if (action === "view-turn") {
    const turn = state.turns.find((item) => String(item.id) === String(id));
    if (!turn) {
      showToast({ title: "Sin detalle", description: "No encontramos la información del turno.", variant: "warning" });
      return;
    }
    alert(JSON.stringify(turn, null, 2));
  }
  if (action === "delete-turn") {
    if (!window.confirm("¿Eliminar este turno de forma permanente?")) return;
    try {
      await deleteTurn(id);
      showToast({ title: "Turno eliminado", description: "El turno se eliminó correctamente.", variant: "success" });
      await loadTurns();
    } catch (error) {
      console.error("Error eliminando turno:", error);
      showToast({ title: "No pudimos eliminar el turno", description: error?.message ?? "", variant: "error" });
    }
  }
}

async function sendMagicLink() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    showToast({ title: "Supabase no disponible", description: "No podemos enviar enlaces mágicos sin la configuración correcta.", variant: "error" });
    return;
  }
  const email = window.prompt("Ingresá el correo del administrador:");
  if (!email) return;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    showToast({ title: "Enlace enviado", description: `Enviamos un enlace mágico a ${email}.`, variant: "success" });
  } catch (error) {
    console.error("Error enviando enlace mágico:", error);
    showToast({ title: "No pudimos enviar el enlace", description: error?.message ?? "", variant: "error" });
  }
}

async function handleLogout() {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  state.session = null;
  state.profile = null;
  showGuard("Sesión finalizada. Volvé a iniciar sesión para continuar.", true);
}

function listenRealtime() {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
  }
  realtimeUnsubscribe = onTurnsRealtime(async () => {
    await loadTurns();
  });
}

function applySavedTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_THEME_KEY);
    if (stored === "dark" || stored === "light") {
      DOM.body.dataset.theme = stored;
    }
  } catch (error) {
    console.warn("No se pudo recuperar el tema almacenado.", error);
  }
}

function toggleTheme() {
  const next = DOM.body.dataset.theme === "dark" ? "light" : "dark";
  DOM.body.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_THEME_KEY, next);
  } catch (error) {
    console.warn("No se pudo persistir el tema.", error);
  }
}

window.addEventListener("beforeunload", () => {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
  }
});

