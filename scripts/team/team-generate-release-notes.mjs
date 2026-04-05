import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const artifactsDir = path.join(root, '.release-artifacts');
const manifestPath = path.join(artifactsDir, 'release-manifest.json');
const versionStoryPath = path.join(artifactsDir, 'VERSION-STORY.json');
const notesPath = path.join(artifactsDir, 'RELEASE-NOTES.md');

if (!fs.existsSync(manifestPath)) {
  throw new Error('release-manifest.json missing; run npm run release:stage-artifacts first');
}
if (!fs.existsSync(versionStoryPath)) {
  throw new Error('VERSION-STORY.json missing; run npm run release:stage-artifacts first');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const versionStory = JSON.parse(fs.readFileSync(versionStoryPath, 'utf8'));
const releaseTag = versionStory.releaseTag || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${versionStory.repoReleaseTrack.version}`;

function sh(command) {
  try {
    return execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const tags = sh('git tag --sort=-creatordate').split('\n').map((x) => x.trim()).filter(Boolean);
const previousTag = tags.find((tag) => tag !== releaseTag) || '';
const commitLines = (previousTag
  ? sh(`git log --oneline ${previousTag}..HEAD`)
  : sh('git log --oneline -n 20')
).split('\n').map((line) => line.trim()).filter(Boolean);

const artifactTargetLines = Object.entries(manifest.targets)
  .map(([key, value]) => `- **${key}** — ${JSON.stringify(value)}`)
  .join('\n');
const commitSummaryLines = commitLines.length > 0
  ? commitLines.map((line) => `- ${line}`).join('\n')
  : '- No commit summary available';
const previousTagBlock = previousTag ? `## Previous Tag\n\n- ${previousTag}\n\n` : '';

const notes = [
  `# Release Notes — ${releaseTag}`,
  '',
  '## Version Story',
  '',
  '| Track | Version | Includes |',
  '|---|---:|---|',
  `| Repo release track | ${versionStory.repoReleaseTrack.version} | ${versionStory.repoReleaseTrack.includes.join(', ')} |`,
  `| Standalone harness track | ${versionStory.standaloneHarnessTrack.version} | ${versionStory.standaloneHarnessTrack.includes.join(', ')} |`,
  '',
  '## Highlights',
  '',
  '- Public release artifacts are staged through a reproducible `.release-artifacts/` tree.',
  '- GitHub CI uploads public-contracts, dashboard static export, OSS minimal evidence, third-party sample, and source-docs bundles.',
  '- Tag-triggered publish attaches release bundles plus machine-readable provenance and version-story metadata.',
  '',
  '## Attached Release Assets',
  '',
  '- public-contracts.tar.gz',
  '- dashboard-static-export.tar.gz',
  '- oss-minimal-evidence.tar.gz',
  '- third-party-agent-sample.tar.gz',
  '- source-docs.tar.gz',
  '- SHA256SUMS.txt',
  '- PROVENANCE.json',
  '- VERSION-STORY.json',
  '- RELEASE-NOTES.md',
  '',
  '## Artifact Targets',
  '',
  artifactTargetLines,
  '',
  '## Commit Summary',
  '',
  commitSummaryLines,
  '',
  previousTagBlock,
].join('\n');

fs.writeFileSync(notesPath, notes);
console.log(JSON.stringify({ ok: true, releaseTag, previousTag, notesPath }, null, 2));
