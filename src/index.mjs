import { startServer } from '../apps/api-server/src/index.mjs';
import { pathToFileURL } from 'node:url';

const isDirectRun = (() => {
  const entry = process.argv?.[1];
  if (!entry) return false;
  try {
    const entryUrl = pathToFileURL(entry).href;
    return import.meta.url === entryUrl;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  await startServer();
}

export { startServer };