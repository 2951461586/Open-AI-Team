import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const provenancePath = path.join(root, 'fixtures', 'public-contracts', 'real-run', 'fixture-provenance.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const data = readJson(provenancePath);
const sampling = data?.sampling || {};
const samplingSummary = Object.fromEntries(
  Object.entries(sampling).map(([name, cfg]) => [name, {
    mode: cfg?.mode || '',
    start: cfg?.start ?? null,
    limit: cfg?.limit ?? null,
    nestedCaps: cfg?.nestedCaps || null,
  }]),
);

console.log(JSON.stringify({
  ok: true,
  provenancePath,
  kind: data?.kind || '',
  sourceRunId: data?.sourceRunId || '',
  sourceRunDir: data?.sourceRunDir || '',
  generationScript: data?.generationScript || '',
  publishedFiles: data?.files || [],
  observedCounts: data?.observedCounts || {},
  samplingSummary,
}, null, 2));
