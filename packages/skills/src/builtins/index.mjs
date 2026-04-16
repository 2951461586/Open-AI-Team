import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BUILTIN_SKILLS_DIR = join(__dirname);

export async function getBuiltinSkills() {
  const entries = await readdir(BUILTIN_SKILLS_DIR, { withFileTypes: true });
  const skills = [];
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(BUILTIN_SKILLS_DIR, entry.name, 'skill.manifest.json');
    try {
      const manifestStat = await stat(manifestPath);
      if (manifestStat.isFile()) {
        skills.push(entry.name);
      }
    } catch {
      // skip
    }
  }
  
  return skills;
}

export const SKILL_IDS = [
  'web-search',
  'research',
  'report-generation',
  'code-review',
  'image-generation',
  'chart-visualization',
  'slide-creation',
  'document',
  'translation',
  'data-analysis',
  'skill-creator',
];
