const REMEMBER_UNTIL_KEY = 'ct_remember_until';
const TAB_SESSION_KEY = 'ct_tab_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function markAuthSession(rememberFor30Days: boolean) {
  sessionStorage.setItem(TAB_SESSION_KEY, '1');

  if (rememberFor30Days) {
    localStorage.setItem(REMEMBER_UNTIL_KEY, String(Date.now() + THIRTY_DAYS_MS));
    return;
  }

  localStorage.removeItem(REMEMBER_UNTIL_KEY);
}

export function shouldKeepAuthSession() {
  const rememberUntilRaw = localStorage.getItem(REMEMBER_UNTIL_KEY);
  const tabSessionActive = sessionStorage.getItem(TAB_SESSION_KEY) === '1';

  if (!rememberUntilRaw) {
    return tabSessionActive;
  }

  const rememberUntil = Number(rememberUntilRaw);
  if (!Number.isFinite(rememberUntil)) {
    localStorage.removeItem(REMEMBER_UNTIL_KEY);
    return tabSessionActive;
  }

  if (Date.now() <= rememberUntil) {
    return true;
  }

  localStorage.removeItem(REMEMBER_UNTIL_KEY);
  return tabSessionActive;
}

export function clearAuthSessionMarkers() {
  localStorage.removeItem(REMEMBER_UNTIL_KEY);
  sessionStorage.removeItem(TAB_SESSION_KEY);
}
