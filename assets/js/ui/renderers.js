import { FALLBACK_TREATMENT_IMG } from '../state/sampleData.js';

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeId(value) {
  return value !== null && value !== undefined ? String(value) : '';
}

export function renderTreatments({
  container,
  treatments = [],
  emptyMessage = 'No hay tratamientos disponibles por el momento.',
  onView,
  onRequest,
} = {}) {
  if (!container) return;
  if (!Array.isArray(treatments) || !treatments.length) {
    container.innerHTML = `<div class="card" style="color:var(--muted);padding:18px;text-align:center">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = '';
  treatments.forEach((treatment) => {
    const id = normalizeId(treatment.id || treatment.name);
    const card = document.createElement('article');
    card.className = 'card treatment-card';
    const image = safeString(treatment.img || treatment.image_url || treatment.image, FALLBACK_TREATMENT_IMG);
    const name = safeString(treatment.name, 'Tratamiento');
    const specialty = safeString(treatment.spec || treatment.specialty, 'Especialidad a confirmar');

    card.innerHTML = `
      <img src="${image}" alt="${name}" />
      <h3>${name}</h3>
      <div style="color:var(--muted)">${specialty}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-ghost" data-action="view" data-id="${encodeURIComponent(id)}">Ver más</button>
        <button class="btn btn-primary" data-action="request" data-id="${encodeURIComponent(id)}">Solicitar turno</button>
      </div>
    `;

    card.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      const encodedId = target.dataset.id;
      if (!action || !encodedId) return;
      const decodedId = decodeURIComponent(encodedId);
      if (action === 'view' && typeof onView === 'function') {
        onView(decodedId);
      }
      if (action === 'request' && typeof onRequest === 'function') {
        onRequest(decodedId);
      }
    });

    container.appendChild(card);
  });
}

export function renderProfessionals({
  container,
  professionals = [],
  emptyMessage = 'No hay profesionales publicados por el momento.',
  onSelect,
} = {}) {
  if (!container) return;
  if (!Array.isArray(professionals) || !professionals.length) {
    container.innerHTML = `<div class="card" style="color:var(--muted);padding:18px;text-align:center">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = '';
  professionals.forEach((professional) => {
    const id = normalizeId(professional.id || professional.name);
    const card = document.createElement('article');
    card.className = 'card';
    const name = safeString(professional.name, 'Profesional');
    const specialty = safeString(professional.spec || professional.specialty, 'Especialidad');
    const bio = safeString(professional.bio || professional.description, 'Consultá para más información.');

    const canSelect = Boolean(id);
    card.innerHTML = `
      <h3>${name}</h3>
      <div style="color:var(--muted)">${specialty}</div>
      <p style="margin:8px 0">${bio}</p>
      <div style="text-align:right">
        <button class="btn btn-primary" data-action="select" data-id="${encodeURIComponent(id)}"${
          canSelect ? '' : ' disabled style="opacity:0.6;cursor:not-allowed"'
        }>
          Sacar turno con este médico
        </button>
      </div>
    `;

    if (canSelect) {
      card.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action === 'select' && typeof onSelect === 'function') {
          onSelect(decodeURIComponent(target.dataset.id ?? ''));
        }
      });
    }

    container.appendChild(card);
  });
}

export function renderNextTurns(container, turns = [], { emptyMessageLoggedOut, emptyMessageNoData } = {}) {
  if (!container) return;
  if (!Array.isArray(turns) || !turns.length) {
    container.innerHTML = `<div style="color:var(--muted);padding:10px;border:1px dashed var(--muted);border-radius:var(--radius-md);margin-top:10px">${emptyMessageNoData || 'No hay turnos próximos'}</div>`;
    return;
  }

  container.innerHTML = turns
    .map(
      (turn) => `
      <div class="card" style="margin-bottom:10px">
        <strong>${safeString(turn.specialty, 'Especialidad')} — ${safeString(turn.professional, 'Sin asignar')}</strong>
        <div style="color:var(--muted)">${safeString(turn.date, '')} ${safeString(turn.time, '')} • ${safeString(turn.type, '')}</div>
      </div>
    `,
    )
    .join('');
}

export function statusPill(status) {
  if (status === 'pendiente') return '<span class="pill pending">Pendiente</span>';
  if (status === 'confirmado') return '<span class="pill confirmed">Confirmado</span>';
  return '<span class="pill cancel">Cancelado</span>';
}

export function renderTurnsTable(container, turns = []) {
  if (!container) return;
  if (!Array.isArray(turns) || !turns.length) {
    container.innerHTML =
      '<div style="color:var(--muted);padding:10px;border:1px dashed var(--muted);border-radius:var(--radius-md)">No registrás turnos aún.</div>';
    return;
  }

  const rows = turns
    .map(
      (turn) => `
      <tr data-row-id="${encodeURIComponent(normalizeId(turn.id))}">
        <td>${safeString(turn.date)}</td>
        <td>${safeString(turn.time)}</td>
        <td>${safeString(turn.professional, '-')}</td>
        <td>${safeString(turn.type)}</td>
        <td>${statusPill(turn.status)}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost" style="padding:6px" data-action="reprogram">Reprogramar</button>
            <button class="btn btn-ghost" style="padding:6px" data-action="cancel">Cancelar</button>
            <button class="btn btn-ghost" style="padding:6px" data-action="view">Ver</button>
          </div>
        </td>
      </tr>
    `,
    )
    .join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Médico</th>
          <th>Tipo</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

