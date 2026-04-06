CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_role_status_updated ON tasks(role, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_role_status ON members(role, status);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'generic',
  body_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_task_role_updated ON artifacts(task_id, role, updated_at DESC);

CREATE TABLE IF NOT EXISTS mailbox (
  id TEXT PRIMARY KEY,
  from_role TEXT NOT NULL DEFAULT '',
  to_role TEXT NOT NULL DEFAULT '',
  task_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'message',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mailbox_to_role_created ON mailbox(to_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_task_created ON mailbox(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blackboard (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_blackboard_section_key_version ON blackboard(section, entry_key, version);
CREATE INDEX IF NOT EXISTS idx_blackboard_section_updated ON blackboard(section, updated_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_role_state_updated ON sessions(role, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS desk_files (
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(role, name)
);

CREATE TABLE IF NOT EXISTS desk_notes (
  role TEXT NOT NULL,
  note_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(role, note_id)
);
