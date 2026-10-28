const KEYS = Object.freeze({
  access: "pencmi_access_token",
  refresh: "pencmi_refresh_token",
  session: "pencmi_current_session",
});
const REFRESH_LOCK = "pencmi.refresh";
const REFRESH_TIMEOUT_MS = 15000;
const STORAGE_SYNC_TIMEOUT_MS = 1500;
const STORAGE_SYNC_POLL_MS = 20;
const SESSION_MESSAGES = Object.freeze({
  invalid: "Votre session a expiré. Veuillez vous reconnecter.",
  changed: "La session a changé. Veuillez vous reconnecter.",
  uncertain: "Le renouvellement n’a pas pu être confirmé. Reconnectez-vous pour continuer.",
  offline: "Connexion indisponible. Réessayez lorsque le réseau sera rétabli.",
  storageUnavailable: "Le stockage de session est indisponible. Veuillez vous reconnecter.",
  unsupported: "Ce navigateur ne permet pas de renouveler la session en toute sécurité. Veuillez vous reconnecter.",
  loginFailed: "Connexion impossible. Veuillez réessayer.",
});

export class SessionRefreshError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SessionRefreshError";
    this.code = code;
  }
}

export function createTokenSession(platform) {
  let inFlight = null;
  let database = null;
  const storage = platform.localStorage;
  const snapshot = () => ({ accessToken: storage.getItem(KEYS.access) || "", refreshToken: storage.getItem(KEYS.refresh) || "" });
  const unchanged = (before) => {
    const current = snapshot();
    return current.accessToken === before.accessToken && current.refreshToken === before.refreshToken;
  };
  const openDatabase = () => database ||= new Promise((resolve, reject) => {
    const request = platform.indexedDB.open("pencmi-auth-refresh", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("attempts", { keyPath: "fingerprint" });
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
    request.onerror = request.onblocked = () => reject(new SessionRefreshError("COORDINATION_UNAVAILABLE", SESSION_MESSAGES.storageUnavailable));
  });
  const attemptStore = async (fingerprint, record) => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("attempts", record ? "readwrite" : "readonly");
      const operation = record ? tx.objectStore("attempts").put(record) : tx.objectStore("attempts").get(fingerprint);
      tx.oncomplete = () => resolve(record || operation.result);
      tx.onerror = tx.onabort = () => reject(new SessionRefreshError("COORDINATION_UNAVAILABLE", SESSION_MESSAGES.storageUnavailable));
    });
  };
  const waitForUpdatedCredentials = async (before) => {
    const deadline = Date.now() + STORAGE_SYNC_TIMEOUT_MS;
    do {
      const current = snapshot();
      if (current.accessToken && current.refreshToken && current.accessToken !== before.accessToken && current.refreshToken !== before.refreshToken) return current;
      if (!current.accessToken && !current.refreshToken) throw new SessionRefreshError("SESSION_CHANGED", SESSION_MESSAGES.changed);
      await new Promise((resolve) => platform.setTimeout(resolve, STORAGE_SYNC_POLL_MS));
    } while (Date.now() < deadline);
    throw uncertain();
  };
  const invalidate = (before) => {
    if (!unchanged(before)) return false;
    storage.removeItem(KEYS.access);
    storage.removeItem(KEYS.refresh);
    storage.removeItem(KEYS.session);
    return true;
  };
  const uncertain = () => new SessionRefreshError("REFRESH_UNCERTAIN", SESSION_MESSAGES.uncertain);
  const supported = () => Boolean(platform.navigator?.locks?.request && platform.crypto?.subtle && platform.crypto?.randomUUID && platform.indexedDB);
  const fingerprintOf = async (token) => {
    const digest = await platform.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  };
  const writeTokens = (tokens) => {
    storage.setItem(KEYS.refresh, tokens.refreshToken);
    storage.setItem(KEYS.access, tokens.accessToken);
  };

  async function install(tokens) {
    if (typeof tokens?.accessToken !== "string" || !tokens.accessToken || typeof tokens.refreshToken !== "string" || !tokens.refreshToken) throw new SessionRefreshError("SESSION_INVALID", SESSION_MESSAGES.loginFailed);
    if (!supported()) { writeTokens(tokens); return; }
    await platform.navigator.locks.request(REFRESH_LOCK, { mode: "exclusive" }, async () => {
      const before = snapshot();
      if (before.refreshToken && before.refreshToken !== tokens.refreshToken) {
        const fingerprint = await fingerprintOf(before.refreshToken);
        if (!await attemptStore(fingerprint)) await attemptStore(fingerprint, { fingerprint, state: "superseded" });
      }
      writeTokens(tokens);
    });
  }

  async function invalidateCurrent(before) {
    if (!supported()) return invalidate(before);
    return platform.navigator.locks.request(REFRESH_LOCK, { mode: "exclusive" }, async () => {
      if (!unchanged(before)) return false;
      if (before.refreshToken) {
        const fingerprint = await fingerprintOf(before.refreshToken);
        const attempt = await attemptStore(fingerprint);
        if (attempt && ["completed", "superseded"].includes(attempt.state)) return false;
        await attemptStore(fingerprint, { fingerprint, state: "invalid" });
      }
      return invalidate(before);
    });
  }

  async function performRefresh(baseUrl, failedAccessToken) {
    const before = snapshot();
    if (before.accessToken && failedAccessToken !== undefined && before.accessToken !== failedAccessToken) return before;
    if (!before.refreshToken) throw new SessionRefreshError("SESSION_INVALID", SESSION_MESSAGES.invalid);
    if (platform.navigator?.onLine === false) throw new SessionRefreshError("NETWORK_UNAVAILABLE", SESSION_MESSAGES.offline);
    const fingerprint = await fingerprintOf(before.refreshToken);
    if (await attemptStore(fingerprint)) return waitForUpdatedCredentials(before);
    const attempt = { id: platform.crypto.randomUUID(), fingerprint, state: "pending" };
    await attemptStore(fingerprint, attempt);
    const controller = new AbortController();
    const timeout = platform.setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
      const response = await platform.fetch(`${baseUrl.replace(/\/+$/, "")}/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: before.refreshToken }), signal: controller.signal,
      });
      if (!unchanged(before)) {
        await attemptStore(fingerprint, { ...attempt, state: "superseded" });
        const current = snapshot();
        if (current.accessToken && current.refreshToken) return current;
        throw new SessionRefreshError("SESSION_CHANGED", SESSION_MESSAGES.changed);
      }
      if (response.status === 401) {
        invalidate(before);
        await attemptStore(fingerprint, { ...attempt, state: "invalid" });
        throw new SessionRefreshError("SESSION_INVALID", SESSION_MESSAGES.invalid);
      }
      if (!response.ok) throw uncertain();
      const payload = await response.json();
      if (!unchanged(before)) {
        await attemptStore(fingerprint, { ...attempt, state: "superseded" });
        const current = snapshot();
        if (current.accessToken && current.refreshToken) return current;
        throw new SessionRefreshError("SESSION_CHANGED", SESSION_MESSAGES.changed);
      }
      const tokens = payload?.data ?? payload;
      if (typeof tokens?.accessToken !== "string" || !tokens.accessToken || typeof tokens.refreshToken !== "string" || !tokens.refreshToken) throw uncertain();
      writeTokens(tokens);
      await attemptStore(fingerprint, { ...attempt, state: "completed" });
      return tokens;
    } catch (error) {
      if (!unchanged(before)) {
        const current = snapshot();
        if (current.accessToken && current.refreshToken) return current;
        throw error;
      }
      if (error?.code === "SESSION_INVALID" || error?.code === "SESSION_CHANGED") throw error;
      await attemptStore(fingerprint, { ...attempt, state: "uncertain" });
      throw uncertain();
    } finally {
      platform.clearTimeout(timeout);
    }
  }

  function refresh(baseUrl, failedAccessToken) {
    const current = snapshot();
    if (current.accessToken && failedAccessToken !== undefined && current.accessToken !== failedAccessToken) return Promise.resolve(current);
    if (inFlight) return inFlight;
    if (!supported()) {
      return Promise.reject(new SessionRefreshError("COORDINATION_UNAVAILABLE", SESSION_MESSAGES.unsupported));
    }
    inFlight = platform.navigator.locks.request(REFRESH_LOCK, { mode: "exclusive" }, () => performRefresh(baseUrl, failedAccessToken))
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  return { refresh, snapshot, install, invalidate: invalidateCurrent };
}

export const tokenSession = typeof window === "undefined" ? null : createTokenSession(window);
