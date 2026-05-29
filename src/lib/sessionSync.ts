/** Cross-tab sign-out signal (localStorage `storage` event). */
export const SESSION_REVOKED_KEY = "flow_session_revoked";

export function broadcastSessionRevoked() {
  try {
    localStorage.setItem(SESSION_REVOKED_KEY, String(Date.now()));
  } catch {
    // private mode / quota
  }
}
