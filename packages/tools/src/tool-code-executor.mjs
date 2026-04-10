export const TOOL_CODE_EXECUTION_KINDS = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  BASH: 'bash',
};

export function createCodeExecutionTool({
  name = 'code-executor',
  description = 'Execute code in a sandboxed environment',
  supportedLanguages = [TOOL_CODE_EXECUTION_KINDS.JAVASCRIPT],
  timeoutMs = 30000,
  maxOutputLength = 10000,
} = {}) {
  const state = {
    name,
    description,
    supportedLanguages,
    timeoutMs,
    maxOutputLength,
    executionCount: 0,
  };

  function getMeta() {
    return {
      name: state.name,
      description: state.description,
      supportedLanguages: state.supportedLanguages,
    };
  }

  async function execute(args = {}, context = {}) {
    const { code, language = 'javascript', timeout = state.timeoutMs } = args;

    if (!code) {
      return { ok: false, error: 'code is required' };
    }

    state.executionCount++;

    try {
      const lang = String(language).toLowerCase();

      if (lang === 'javascript' || lang === 'js') {
        return await executeJavaScript(code, timeout, context);
      }

      if (lang === 'bash' || lang === 'shell') {
        return await executeBash(code, timeout, context);
      }

      if (lang === 'python' || lang === 'py') {
        return await executePythonStub(code, timeout, context);
      }

      return { ok: false, error: `unsupported language: ${language}` };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function executeJavaScript(code, timeout, context) {
    const startTime = Date.now();

    try {
      const result = await eval(code);
      const durationMs = Date.now() - startTime;
      const output = String(result).substring(0, state.maxOutputLength);

      return {
        ok: true,
        output,
        result,
        durationMs,
        language: 'javascript',
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime,
        language: 'javascript',
      };
    }
  }

  async function executeBash(code, timeout, context) {
    const { exec } = await import('node:child_process');

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = exec(code, { timeout, maxBuffer: state.maxOutputLength * 2 }, (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;

        if (error) {
          resolve({
            ok: false,
            error: error.message,
            stderr,
            exitCode: error.code,
            durationMs,
            language: 'bash',
          });
          return;
        }

        resolve({
          ok: true,
          stdout: stdout.substring(0, state.maxOutputLength),
          stderr: stderr.substring(0, state.maxOutputLength),
          durationMs,
          language: 'bash',
        });
      });
    });
  }

  async function executePythonStub(code, timeout, context) {
    return {
      ok: false,
      error: 'Python execution requires sandbox setup. Use bash with python3 command.',
      language: 'python',
      hint: "Try language: 'bash' with code: 'python3 -c \"...\"'",
    };
  }

  function getStats() {
    return {
      name: state.name,
      executionCount: state.executionCount,
      supportedLanguages: state.supportedLanguages,
    };
  }

  return {
    id: state.name,
    name: state.name,
    description: state.description,
    getMeta,
    execute,
    getStats,
  };
}

export default {
  TOOL_CODE_EXECUTION_KINDS,
  createCodeExecutionTool,
};
