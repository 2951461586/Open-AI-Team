export const DB_KINDS = {
  SQLITE: 'sqlite',
  MEMORY: 'memory',
};

export const DB_OPERATIONS = {
  QUERY: 'query',
  INSERT: 'insert',
  UPDATE: 'update',
  DELETE: 'delete',
  EXECUTE: 'execute',
};

export function createDatabaseTool({
  name = 'database',
  description = 'Execute database queries',
  kind = DB_KINDS.SQLITE,
  connectionPath = ':memory:',
} = {}) {
  let db = null;
  let connected = false;

  const state = {
    name,
    description,
    kind,
    connectionPath,
    queryCount: 0,
  };

  async function connect() {
    if (connected) return { ok: true, alreadyConnected: true };

    try {
      if (state.kind === DB_KINDS.SQLITE) {
        const { default: Database } = await import('better-sqlite3');
        db = new Database(state.connectionPath === ':memory:' ? ':memory:' : state.connectionPath);
        connected = true;
        return { ok: true };
      }

      return { ok: false, error: `unsupported database kind: ${state.kind}` };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function disconnect() {
    if (!connected || !db) return { ok: true };

    try {
      db.close();
      connected = false;
      db = null;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function getMeta() {
    return {
      name: state.name,
      description: state.description,
      kind: state.kind,
      connectionPath: state.connectionPath,
      connected,
    };
  }

  async function execute(args = {}, context = {}) {
    const { operation = 'query', sql, params = [] } = args;

    if (!sql) {
      return { ok: false, error: 'sql is required' };
    }

    state.queryCount++;

    if (!connected) {
      await connect();
    }

    try {
      const op = String(operation).toLowerCase();

      if (op === 'query' || op === 'select') {
        return executeQuery(sql, params);
      }

      if (op === 'insert' || op === 'update' || op === 'delete') {
        return executeWrite(sql, params);
      }

      if (op === 'execute' || op === 'run') {
        return executeRaw(sql, params);
      }

      return { ok: false, error: `unsupported operation: ${operation}` };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function executeQuery(sql, params) {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      return {
        ok: true,
        operation: 'query',
        rows,
        rowCount: rows.length,
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function executeWrite(sql, params) {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        ok: true,
        operation: 'write',
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function executeRaw(sql, params) {
    try {
      db.exec(sql);
      return {
        ok: true,
        operation: 'execute',
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function getStats() {
    return {
      name: state.name,
      kind: state.kind,
      queryCount: state.queryCount,
      connected,
    };
  }

  return {
    id: state.name,
    name: state.name,
    description: state.description,
    getMeta,
    execute,
    connect,
    disconnect,
    getStats,
  };
}

export default {
  DB_KINDS,
  DB_OPERATIONS,
  createDatabaseTool,
};
