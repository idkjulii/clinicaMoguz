let turnModalRoot = null;
let loginModalRoot = null;

export function configureModals({ turnRoot, loginRoot }) {
  turnModalRoot = turnRoot;
  loginModalRoot = loginRoot;
}

export function closeTurnModal() {
  if (turnModalRoot) turnModalRoot.innerHTML = '';
}

export function closeLoginModal() {
  if (loginModalRoot) loginModalRoot.innerHTML = '';
}

export function openTurnModal({
  professionals = [],
  specialties = ['Cirugía Plástica', 'Cirugía Reconstructiva', 'Estética'],
  values = {},
  onSubmit,
  onCancel,
  onRequireAuth,
  isSupabaseAvailable,
  isUserLogged,
} = {}) {
  if (!turnModalRoot) return;

  if (!isUserLogged) {
    window.alert('Iniciá sesión para solicitar turnos.');
    if (typeof onRequireAuth === 'function') onRequireAuth();
    return;
  }

  if (!isSupabaseAvailable) {
    window.alert('Activá la base de datos o habilitá el modo demo para gestionar turnos.');
    return;
  }

  const professionalOptions = professionals
    .map(
      (pro) => `<option value="${pro.name}">${pro.name} — ${pro.spec || pro.specialty}</option>`,
    )
    .join('');

  const specialtyOptions = specialties
    .map((spec) => `<option value="${spec}">${spec}</option>`)
    .join('');

  turnModalRoot.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>Solicitar turno</h3>
          <button aria-label="Cerrar" data-close-turn class="btn btn-ghost" style="border-radius:50%;padding:6px 10px">✕</button>
        </div>
        <form id="turn-form" style="margin-top:20px">
          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;">
            <select name="type" required>
              <option value="Presencial">Presencial</option>
              <option value="Virtual">Virtual</option>
            </select>
            <select name="specialty" required>
              ${specialtyOptions}
            </select>
          </div>

          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
            <select name="professional">
              <option value="">-- Profesional (opcional) --</option>
              ${professionalOptions}
            </select>
            <input type="date" name="date" required />
          </div>

          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
            <input type="time" name="time" required />
            <input type="text" name="patient" placeholder="Nombre del paciente" required />
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px">
            <small style="color:var(--muted)">Podés reprogramar o cancelar desde "Mis turnos"</small>
            <div>
              <button type="button" data-close-turn class="btn btn-ghost">Cancelar</button>
              <button type="submit" class="btn btn-primary" style="margin-left:10px">Confirmar turno</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = turnModalRoot.querySelector('#turn-form');
  const typeField = form?.querySelector('select[name="type"]');
  const specialtyField = form?.querySelector('select[name="specialty"]');
  const professionalField = form?.querySelector('select[name="professional"]');
  const dateField = form?.querySelector('input[name="date"]');
  const timeField = form?.querySelector('input[name="time"]');
  const patientField = form?.querySelector('input[name="patient"]');

  if (values.type && typeField) typeField.value = values.type;
  if (values.specialty && specialtyField) {
    if (![...specialtyField.options].some((option) => option.value === values.specialty)) {
      const customOption = document.createElement('option');
      customOption.value = values.specialty;
      customOption.textContent = values.specialty;
      specialtyField.appendChild(customOption);
    }
    specialtyField.value = values.specialty;
  }
  if (values.professional && professionalField) professionalField.value = values.professional;
  if (values.date && dateField) dateField.value = values.date;
  if (values.time && timeField) timeField.value = values.time;
  if (values.patient && patientField) patientField.value = values.patient;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (typeof onSubmit === 'function') {
      const formData = new FormData(form);
      onSubmit(Object.fromEntries(formData.entries()));
    }
  });

  turnModalRoot.querySelectorAll('[data-close-turn]').forEach((btn) =>
    btn.addEventListener('click', () => {
      closeTurnModal();
      if (typeof onCancel === 'function') onCancel();
    }),
  );
}

export function openLoginModal({ onSubmit, onDemoLogin } = {}) {
  if (!loginModalRoot) return;

  loginModalRoot.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal" style="max-width:400px;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>Iniciar sesión</h3>
          <button aria-label="Cerrar" data-close-login class="btn btn-ghost" style="border-radius:50%;padding:6px 10px">✕</button>
        </div>
        <form id="login-form" style="margin-top:20px">
          <div class="form-row">
            <input type="email" name="email" placeholder="Correo electrónico" required />
          </div>
          <div style="color:var(--muted);font-size:12px;margin-bottom:15px">
            Te enviaremos un enlace mágico a este correo para iniciar sesión al instante.
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;flex-wrap:wrap;gap:12px">
            <button type="button" data-demo-login class="btn btn-ghost">Modo demo</button>
            <div style="display:flex;gap:10px">
              <button type="button" data-close-login class="btn btn-ghost">Cancelar</button>
              <button type="submit" class="btn btn-primary">Enviar enlace</button>
            </div>
          </div>
          <small style="display:block;margin-top:6px;color:var(--muted);font-size:12px">
            El modo demo crea una sesión local sin correo y guarda los datos únicamente en este dispositivo.
          </small>
        </form>
      </div>
    </div>
  `;

  const loginForm = loginModalRoot.querySelector('#login-form');
  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = (formData.get('email') || '').toString().trim();
    if (!email) {
      window.alert('Ingrese un correo electrónico');
      return;
    }
    if (typeof onSubmit === 'function') {
      onSubmit(email);
    }
  });

  const demoBtn = loginModalRoot.querySelector('[data-demo-login]');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      if (typeof onDemoLogin === 'function') {
        onDemoLogin();
      }
    });
  }

  loginModalRoot.querySelectorAll('[data-close-login]').forEach((btn) =>
    btn.addEventListener('click', () => {
      closeLoginModal();
    }),
  );
}

