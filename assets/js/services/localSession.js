const LOCAL_SESSION_KEY = 'moguz-local-session';

function buildSession({ email, role = 'client', fullName }) {
  const safeEmail = email || 'demo@clinicamoguz.com';
  const displayName = fullName || safeEmail.split('@')[0] || 'Usuario';
  const id = `local-${safeEmail}`;

  const session = {
    user: {
      id,
      email: safeEmail,
      user_metadata: { full_name: displayName },
      app_metadata: { provider: 'local' },
    },
  };

  const profile = {
    id,
    full_name: displayName,
    role,
  };

  return { session, profile };
}

export function saveLocalSession({ email, role = 'client', fullName } = {}) {
  const data = buildSession({ email, role, fullName });
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(data));
  return data;
}

export function loadLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.session?.user) return null;
    return parsed;
  } catch (error) {
    console.warn('No se pudo leer la sesión local:', error);
    return null;
  }
}

export function clearLocalSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

