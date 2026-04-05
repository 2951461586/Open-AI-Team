export function parseJsonLoose(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(raw);
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {}
  }
  return null;
}

export function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

export function ensureString(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

export function normalizeRiskLevel(v = '') {
  const s = String(v || '').trim().toLowerCase();
  if (['low', 'medium', 'high'].includes(s)) return s;
  return 'medium';
}

export function canFallbackToNativeChatByPolicy(governanceRuntime, role = '') {
  const cfg = governanceRuntime?.getErrorRecoveryConfig?.() || {
    degradation: { enabled: true, fallbackToNativeChat: true },
  };
  const degradation = cfg?.degradation || {};
  if (degradation.enabled === false) return false;
  if (degradation.fallbackToNativeChat === false) return false;
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (['executor', 'planner'].includes(normalizedRole)) return false;
  return true;
}
