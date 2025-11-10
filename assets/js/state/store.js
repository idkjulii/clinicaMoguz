const STORAGE_KEYS = {
  theme: "cm-theme",
};

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (error) {
    console.warn("No se pudo leer la preferencia de tema almacenada.", error);
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let state = {
  theme: getPreferredTheme(),
  session: null,
  profile: null,
  treatments: [],
  professionals: [],
  turns: [],
  upcomingTurns: [],
  navOpen: false,
  chatOpen: false,
  status: {
    treatments: "idle",
    professionals: "idle",
    turns: "idle",
    auth: "idle",
  },
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  const previous = state;
  state = { ...state, ...patch };
  emit(state, previous);
}

export function updateState(updater) {
  const previous = state;
  state = updater({ ...state });
  emit(state, previous);
}

export function subscribe(listener, options = {}) {
  const { immediate = true } = options;
  listeners.add(listener);
  if (immediate) {
    listener(state, state);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch (error) {
    console.warn("No se pudo persistir el tema seleccionado.", error);
  }
}

function emit(next, previous) {
  listeners.forEach((listener) => {
    try {
      listener(next, previous);
    } catch (error) {
      console.error("Error notificando al listener de estado:", error);
    }
  });
}

