import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const releaseRoot = path.join(root, '.release-artifacts');
const targets = process.argv.slice(2).filter(Boolean);
const selected = targets.length > 0 ? new Set(targets) : new Set(['public-contracts', 'dashboard', 'oss-minimal', 'third-party', 'source-docs']);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function newestFile(files) {
  return [...files].sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || '';
}

function sh(command) {
  try {
    return execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

cleanDir(releaseRoot);
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dashboardPkg = JSON.parse(fs.readFileSync(path.join(root, 'dashboard', 'package.json'), 'utf8'));
const ossManifest = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'oss-minimal', 'agent-manifest.json'), 'utf8'));
const thirdPartyManifest = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'third-party-agent-sample', 'agent-manifest.json'), 'utf8'));
const coreManifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'agent-harness-core', 'oss-agent-manifest.json'), 'utf8'));
const releaseTag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${rootPkg.version}`;
const commitSha = sh('git rev-parse HEAD');

const versionStory = {
  ok: true,
  contractVersion: 'release-version-story.v1',
  releaseTag,
  repoReleaseTrack: {
    version: rootPkg.version,
    includes: [
      `root-package@${rootPkg.version}`,
      `dashboard@${dashboardPkg.version}`,
      `third-party-sample@${thirdPartyManifest.version}`,
    ],
    rule: 'public GitHub release narrative follows the repo release track',
  },
  standaloneHarnessTrack: {
    version: coreManifest.version,
    includes: [
      `agent-harness-core@${coreManifest.version}`,
      `oss-minimal@${ossManifest.version}`,
    ],
    rule: 'standalone broker/harness substrate may remain on its own semver track',
  },
};

const manifest = {
  ok: true,
  contractVersion: 'release-artifacts.v2',
  generatedAt: new Date().toISOString(),
  releaseTag,
  targets: {},
};

if (selected.has('public-contracts')) {
  const dest = path.join(releaseRoot, 'public-contracts');
  ensureDir(dest);
  copy(path.join(root, 'schemas'), path.join(dest, 'schemas'));
  copy(path.join(root, 'fixtures', 'public-contracts'), path.join(dest, 'fixtures', 'public-contracts'));
  const schemaCount = listFiles(path.join(dest, 'schemas')).length;
  const fixtureCount = listFiles(path.join(dest, 'fixtures', 'public-contracts')).length;
  manifest.targets['public-contracts'] = { ok: true, schemaCount, fixtureCount };
}

if (selected.has('dashboard')) {
  const outDir = path.join(root, 'dashboard', 'out');
  if (!fs.existsSync(outDir)) {
    throw new Error('dashboard/out missing; run npm run dashboard:build before staging dashboard release artifacts');
  }
  const dest = path.join(releaseRoot, 'dashboard-static-export');
  ensureDir(dest);
  copy(outDir, path.join(dest, 'out'));
  copy(path.join(root, 'dashboard', 'README.md'), path.join(dest, 'README.md'));
  copy(path.join(root, 'dashboard', 'DEPLOY-OSS.md'), path.join(dest, 'DEPLOY-OSS.md'));
  manifest.targets['dashboard'] = {
    ok: true,
    outFileCount: listFiles(path.join(dest, 'out')).length,
  };
}

if (selected.has('oss-minimal')) {
  const runReports = listFiles(path.join(root, 'examples', 'oss-minimal', '.runs')).filter((file) => file.endsWith('run-report.json'));
  if (runReports.length === 0) {
    throw new Error('examples/oss-minimal/.runs has no run-report.json; run npm run demo:oss-minimal before staging oss-minimal artifacts');
  }
  const latest = newestFile(runReports);
  const dest = path.join(releaseRoot, 'oss-minimal');
  ensureDir(dest);
  copy(path.join(root, 'examples', 'oss-minimal', 'README.md'), path.join(dest, 'README.md'));
  copy(path.join(root, 'examples', 'oss-minimal', 'agent-manifest.json'), path.join(dest, 'agent-manifest.json'));
  copy(path.join(root, 'examples', 'oss-minimal', 'agent-package.json'), path.join(dest, 'agent-package.json'));
  copy(latest, path.join(dest, 'latest-run-report.json'));
  manifest.targets['oss-minimal'] = {
    ok: true,
    latestRunReport: path.relative(root, latest),
  };
}

if (selected.has('third-party')) {
  const dest = path.join(releaseRoot, 'third-party-agent-sample');
  ensureDir(dest);
  copy(path.join(root, 'examples', 'third-party-agent-sample', 'README.md'), path.join(dest, 'README.md'));
  copy(path.join(root, 'examples', 'third-party-agent-sample', 'agent-manifest.json'), path.join(dest, 'agent-manifest.json'));
  copy(path.join(root, 'examples', 'third-party-agent-sample', 'agent-package.json'), path.join(dest, 'agent-package.json'));
  copy(path.join(root, 'examples', 'third-party-agent-sample', 'agent-shell.mjs'), path.join(dest, 'agent-shell.mjs'));
  manifest.targets['third-party'] = { ok: true, fileCount: listFiles(dest).length };
}

if (selected.has('source-docs')) {
  const dest = path.join(releaseRoot, 'source-docs');
  ensureDir(dest);
  copy(path.join(root, 'README.md'), path.join(dest, 'README.md'));
  copy(path.join(root, 'GETTING-STARTED.md'), path.join(dest, 'GETTING-STARTED.md'));
  copy(path.join(root, 'ARCHITECTURE.md'), path.join(dest, 'ARCHITECTURE.md'));
  copy(path.join(root, 'LICENSE'), path.join(dest, 'LICENSE'));
  copy(path.join(root, 'docs', 'architecture', 'release-engineering-and-ci.md'), path.join(dest, 'docs', 'architecture', 'release-engineering-and-ci.md'));
  copy(path.join(root, 'docs', 'architecture', 'github-open-source-preflight.md'), path.join(dest, 'docs', 'architecture', 'github-open-source-preflight.md'));
  copy(path.join(root, 'docs', 'architecture', 'release-artifacts-and-publishing.md'), path.join(dest, 'docs', 'architecture', 'release-artifacts-and-publishing.md'));
  copy(path.join(root, 'docs', 'architecture', 'release-notes-provenance-and-version-story.md'), path.join(dest, 'docs', 'architecture', 'release-notes-provenance-and-version-story.md'));
  copy(path.join(root, 'dashboard', 'README.md'), path.join(dest, 'dashboard', 'README.md'));
  manifest.targets['source-docs'] = { ok: true, fileCount: listFiles(dest).length };
}

const provenance = {
  ok: true,
  contractVersion: 'release-provenance.v1',
  generatedAt: manifest.generatedAt,
  releaseTag,
  git: {
    commitSha,
    branch: sh('git branch --show-current'),
  },
  ci: {
    githubRef: process.env.GITHUB_REF || '',
    githubRefName: process.env.GITHUB_REF_NAME || '',
    githubRunId: process.env.GITHUB_RUN_ID || '',
    githubRunNumber: process.env.GITHUB_RUN_NUMBER || '',
    githubWorkflow: process.env.GITHUB_WORKFLOW || '',
  },
  versionStory,
  targets: manifest.targets,
};

fs.writeFileSync(path.join(releaseRoot, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(releaseRoot, 'VERSION-STORY.json'), JSON.stringify(versionStory, null, 2) + '\n');
fs.writeFileSync(path.join(releaseRoot, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ manifest, versionStory, provenance }, null, 2));
