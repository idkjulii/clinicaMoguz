import { getState, setState, subscribe } from '../state/store.js';

const chatHistory = [];
let rootNode = null;
let onRequireLogin = () => {};
let onFetchTurns = async () => [];

function renderClosed() {
  rootNode.innerHTML = `<div class="chat-bubble" id="open-chat" aria-label="Abrir chat">💬</div>`;
  const openButton = rootNode.querySelector('#open-chat');
  if (openButton) {
    openButton.addEventListener('click', () => setState({ isChatOpen: true }));
  }
}

function renderOpen(session) {
  const logMarkup = chatHistory
    .map(
      (msg) => `<div class="msg ${msg.author}">${msg.text}</div>`,
    )
    .join('');

  rootNode.innerHTML = `
    <div class="chat-window" role="dialog" aria-label="Asistente de Clínica Moguz">
      <header>
        <strong>Asistente Clínica Moguz</strong>
        <button id="close-chat" class="btn btn-ghost" style="padding:6px 10px;border-radius:50%">✕</button>
      </header>
      <div class="chat-log" id="chat-log">${logMarkup}</div>
      <div class="quick-buttons">
        <button class="btn btn-ghost" data-quick="Consultar turnos">Consultar turnos</button>
        <button class="btn btn-ghost" data-quick="Ver tratamientos">Ver tratamientos</button>
        <button class="btn btn-ghost" data-quick="Horarios y contacto">Horarios y contacto</button>
      </div>
      <form id="chat-form">
        <input name="q" placeholder="Escribí tu consulta" style="width:100%;padding:10px;border-radius:var(--radius-md);border:1px solid rgba(0,0,0,0.06)" autocomplete="off"/>
      </form>
    </div>
  `;

  const closeBtn = rootNode.querySelector('#close-chat');
  closeBtn?.addEventListener('click', () => setState({ isChatOpen: false }));

  const chatForm = rootNode.querySelector('#chat-form');
  chatForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = new FormData(chatForm).get('q');
    const question = typeof input === 'string' ? input.trim() : '';
    if (!question) return;
    pushUserMessage(question);
    chatForm.reset();
    setTimeout(() => botReply(question, session), 500);
  });

  rootNode.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-quick');
      if (!question) return;
      pushUserMessage(question);
      setTimeout(() => botReply(question, session), 200);
    });
  });

  scrollLogBottom();
}

function scrollLogBottom() {
  const log = rootNode.querySelector('#chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

function pushUserMessage(text) {
  chatHistory.push({ author: 'user', text });
  renderBasedOnState();
}

function pushBotMessage(text) {
  chatHistory.push({ author: 'bot', text });
  renderBasedOnState();
}

async function botReply(rawQuestion, session) {
  const lower = rawQuestion.toLowerCase();

  if (/turnos|turno|cita/.test(lower)) {
    if (!session) {
      pushBotMessage('Necesitás iniciar sesión para revisar tus turnos. Te llevo al modal de acceso.');
      onRequireLogin();
      return;
    }
    const turns = await onFetchTurns();
    if (!turns.length) {
      pushBotMessage('No registrás turnos todavía. Podés solicitar uno desde "Solicitar turno".');
      return;
    }
    pushBotMessage(`Tenés ${turns.length} turno(s) cargado(s). Revisalos desde "Mis turnos".`);
    return;
  }

  if (/tratamiento|estética|rinoplast|lipo/.test(lower)) {
    pushBotMessage('Encontrás la lista completa de tratamientos en la sección "Tratamientos". ¿Querés que filtre alguno en particular?');
    return;
  }

  if (/horario|contacto|tel|teléfono|telefono/.test(lower)) {
    pushBotMessage('Horarios: Lun-Vie 9:00 a 18:00. Tel: (+54) 9 11 5754-2448. Email: contacto@clinicamoguz.com.');
    return;
  }

  pushBotMessage('No estoy seguro de cómo ayudarte con eso. ¿Querés que derive tu consulta a un asistente humano?');
}

function renderBasedOnState() {
  const { isChatOpen, session } = getState();
  if (!rootNode) return;
  if (!chatHistory.length) {
    chatHistory.push({
      author: 'bot',
      text: 'Hola 👋 Soy el asistente virtual de Clínica Moguz. ¿En qué puedo ayudarte?',
    });
  }
  if (isChatOpen) {
    renderOpen(session);
  } else {
    renderClosed();
  }
}

export function initChatbot({ root, onLoginRequest, onFetchTurns }) {
  rootNode = root;
  onRequireLogin = typeof onLoginRequest === 'function' ? onLoginRequest : () => {};
  onFetchTurns = typeof onFetchTurns === 'function' ? onFetchTurns : async () => [];

  renderBasedOnState();
  subscribe(renderBasedOnState);
}

