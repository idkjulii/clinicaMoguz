const subscribers = new Set();

const initialState = {
  treatments: [],
  professionals: [],
  filteredTreatments: [],
  filteredProfessionals: [],
  turns: [],
  session: null,
  profile: null,
  isChatOpen: false,
};

const state = structuredClone(initialState);

function notify() {
  subscribers.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.error('Error notificando al suscriptor del store:', error);
    }
  });
}

export function getState() {
  return state;
}

export function setState(updater) {
  const update =
    typeof updater === 'function'
      ? updater({ ...state })
      : typeof updater === 'object'
        ? updater
        : null;

  if (!update) return;

  Object.assign(state, update);
  notify();
}

export function resetState() {
  Object.assign(state, structuredClone(initialState));
  notify();
}

export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

