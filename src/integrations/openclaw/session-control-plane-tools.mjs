export const OPENCLAW_SESSION_CONTROL_PLANE_TOOLS = Object.freeze({
  spawnSession: 'sessions_spawn',
  sendToSession: 'sessions_send',
  listSessions: 'sessions_list',
  getSessionHistory: 'sessions_history',
});

export function createOpenClawSessionControlPlaneTools(overrides = {}) {
  return {
    ...OPENCLAW_SESSION_CONTROL_PLANE_TOOLS,
    ...(overrides && typeof overrides === 'object' ? overrides : {}),
  };
}
