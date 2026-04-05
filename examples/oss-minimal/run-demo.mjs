import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStandaloneHarness } from './standalone-bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, 'agent-manifest.json');
const defaultUserText = '帮我做一个更像 deer-flow / OpenHanako 的 AI Team 开源最小样板，至少具备多角色编排、workspace、artifact、registry、memory、report。';

function parseArgs(argv = []) {
  const out = {
    mode: 'sync',
    runDir: '',
    steps: Infinity,
    stream: false,
    crashAfterMs: 0,
    crashAfterCompletions: 0,
    textParts: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--start-only') {
      out.mode = 'start-only';
    } else if (arg === '--resume') {
      out.mode = 'resume';
      out.runDir = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--steps') {
      out.steps = Number(argv[index + 1] || 1) || 1;
      index += 1;
    } else if (arg === '--drain') {
      out.steps = Infinity;
    } else if (arg === '--stream') {
      out.stream = true;
    } else if (arg === '--crash-after-ms') {
      out.crashAfterMs = Number(argv[index + 1] || 0) || 0;
      index += 1;
    } else if (arg === '--crash-after-completions') {
      out.crashAfterCompletions = Number(argv[index + 1] || 0) || 0;
      index += 1;
    } else {
      out.textParts.push(arg);
    }
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
const userText = args.textParts.join(' ').trim() || defaultUserText;
const harness = await createStandaloneHarness({
  manifestPath,
  runtimeOptions: {
    crashAfterCompletions: args.crashAfterCompletions,
  },
});

const onChunk = args.stream
  ? async (chunk) => {
      const head = `[chunk] role=${chunk.role} label=${chunk.label} ${chunk.index}/${chunk.total}`;
      const body = String(chunk.delta || '').replace(/\s+/g, ' ').slice(0, 160);
      console.error(`${head} ${body}`);
    }
  : null;

if (args.crashAfterMs > 0) {
  setTimeout(() => {
    console.error(`[crash] forced process exit after ${args.crashAfterMs}ms`);
    process.exit(99);
  }, args.crashAfterMs).unref();
}

let output = null;
if (args.mode === 'start-only') {
  output = await harness.createRun(userText);
} else if (args.mode === 'resume') {
  if (!args.runDir) throw new Error('--resume requires <runDir>');
  output = await harness.resumeRun({ runDir: args.runDir, steps: args.steps, onChunk });
} else {
  output = await harness.runTask(userText, { onChunk });
}

console.log(JSON.stringify(output, null, 2));
