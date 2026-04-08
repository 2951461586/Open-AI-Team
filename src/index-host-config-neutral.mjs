// Deprecated compatibility shim.
// Host-config authority lives in `./index-host-config.mjs`.
// Keep this file logic-free; do not add new behavior here.
export {
  safeReadJson,
  firstNonEmpty,
  firstNumber,
  resolveEnvValue,
  loadRepoConfigJson,
  loadNeutralHostRuntimeConfig,
} from './index-host-config.mjs';
