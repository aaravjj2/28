const STORAGE_KEY = "twenty-eight-session";

export type StoredSession = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  displayName: string;
};

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.roomCode || !parsed.playerId || !parsed.sessionToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
