import fs from 'node:fs';
import path from 'node:path';
import { openTeamStore } from '../team/team-store.mjs';
import { loadTeamRolesConfig } from '../team/team-roles-config.mjs';

function safeJsonParse(raw, fallback = null) { try { return JSON.parse(String(raw || '')); } catch { return fallback; } }
function readJsonIfExists(filePath, fallback = null) { try { return safeJsonParse(fs.readFileSync(filePath, 'utf8'), fallback); } catch { return fallback; } }
function normalizeScope(scope = 'default') { return String(scope || 'default').trim() || 'default'; }
function encodeResource(payload) { return { contents: [{ uri: payload.uri, mimeType: 'application/json', text: JSON.stringify(payload.body, null, 2) }] }; }

export function createMcpResources({ rootDir = process.cwd(), config = {} } = {}) {
  const teamStore = openTeamStore(path.resolve(rootDir, config.teamDbPath || 'data/team.db'));
  const rolesPath = path.resolve(rootDir, 'config/team/roles.json');
  const governancePath = path.resolve(rootDir, 'config/team/governance.json');
  const toolsPath = path.resolve(rootDir, 'config/team/tools.json');
  const personalitiesPath = path.resolve(rootDir, 'config/team/personalities.json');

  const templates = [
    { uriTemplate: 'team://{scope}/tasks', name: 'team tasks', description: 'Recent tasks for a scope/team.' },
    { uriTemplate: 'team://{scope}/status', name: 'team status', description: 'Aggregated board/status summary.' },
    { uriTemplate: 'team://{scope}/members', name: 'team members', description: 'Members for a scope/team.' },
    { uriTemplate: 'team://{scope}/board', name: 'team board', description: 'Board-like task grouping by state.' },
    { uriTemplate: 'team://config/roles', name: 'roles config', description: 'Declared role configuration.' },
    { uriTemplate: 'team://config/governance', name: 'governance config', description: 'Governance pipeline configuration.' },
    { uriTemplate: 'team://config/personalities', name: 'personalities config', description: 'Team personality configuration if present.' },
  ];

  function listResources() {
    return [
      { uri: 'team://config/roles', name: 'Roles config', mimeType: 'application/json', description: 'Resolved team role declarations.' },
      { uri: 'team://config/governance', name: 'Governance config', mimeType: 'application/json', description: 'Team governance contract.' },
      { uri: 'team://config/tools', name: 'Tools config', mimeType: 'application/json', description: 'Tool provider config.' },
    ];
  }

  function buildBoard(teamId) {
    const tasks = teamId ? teamStore.listTasksByTeam(teamId) : teamStore.listRecentTasks(200);
    const columns = {};
    for (const task of tasks) {
      const key = String(task?.state || 'unknown');
      if (!columns[key]) columns[key] = [];
      columns[key].push(task);
    }
    return { total: tasks.length, columns };
  }

  async function readResource(uri = '') {
    const target = String(uri || '').trim();
    if (target === 'team://config/roles') return encodeResource({ uri: target, body: loadTeamRolesConfig(rolesPath) });
    if (target === 'team://config/governance') return encodeResource({ uri: target, body: readJsonIfExists(governancePath, {}) });
    if (target === 'team://config/tools') return encodeResource({ uri: target, body: readJsonIfExists(toolsPath, {}) });
    if (target === 'team://config/personalities') return encodeResource({ uri: target, body: readJsonIfExists(personalitiesPath, { ok: false, error: 'not_found' }) });

    const match = target.match(/^team:\/\/([^/]+)\/(tasks|status|members|board)$/);
    if (!match) throw new Error(`resource_not_found:${target}`);
    const [, rawScope, kind] = match;
    const scope = normalizeScope(rawScope);
    const teamId = scope === 'default' || scope === 'all' ? '' : scope;

    if (kind === 'tasks') return encodeResource({ uri: target, body: { scope, items: teamId ? teamStore.listTasksByTeam(teamId) : teamStore.listRecentTasks(100), count: teamId ? teamStore.listTasksByTeam(teamId).length : teamStore.listRecentTasks(100).length } });
    if (kind === 'members') return encodeResource({ uri: target, body: { scope, items: teamId ? teamStore.listMembersByTeam(teamId) : [], count: teamId ? teamStore.listMembersByTeam(teamId).length : 0 } });
    if (kind === 'board') return encodeResource({ uri: target, body: { scope, board: buildBoard(teamId) } });
    if (kind === 'status') {
      const tasks = teamId ? teamStore.listTasksByTeam(teamId) : teamStore.listRecentTasks(100);
      const board = buildBoard(teamId);
      const stateCounts = Object.fromEntries(Object.entries(board.columns).map(([k, v]) => [k, v.length]));
      return encodeResource({ uri: target, body: { scope, taskCount: tasks.length, stateCounts, activeStates: Object.keys(stateCounts).filter((k) => !['done', 'cancelled'].includes(k)) } });
    }
    throw new Error(`resource_not_found:${target}`);
  }

  return { listResources, resourceTemplates: templates, readResource };
}
