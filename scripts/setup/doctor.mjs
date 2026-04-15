#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function logOk(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function logFail(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}

function logWarn(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

function logInfo(msg) {
  console.log(`${BLUE}ℹ${RESET} ${msg}`);
}

function logHeader(msg) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}

async function checkNode() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    logOk(`Node.js ${version} (meets requirement: 18+)`);
    return true;
  }
  logFail(`Node.js ${version} (requirement: 18+)`);
  return false;
}

async function checkPnpm() {
  try {
    const { stdout } = await runCommand('pnpm', ['--version']);
    const version = stdout.trim();
    if (version.startsWith('9')) {
      logOk(`pnpm ${version} (meets requirement: 9.x)`);
      return true;
    }
    logWarn(`pnpm ${version} (recommendation: 9.x)`);
    return true;
  } catch {
    logFail('pnpm not found (requirement: pnpm 9.x)');
    console.log(`  Run: corepack enable pnpm`);
    return false;
  }
}

async function checkDocker() {
  try {
    await runCommand('docker', ['--version']);
    logOk('Docker installed');
    try {
      await runCommand('docker', ['compose', 'version']);
      logOk('Docker Compose installed');
      return true;
    } catch {
      logFail('Docker Compose not found');
      return false;
    }
  } catch {
    logWarn('Docker not found (optional for local development)');
    return true;
  }
}

async function checkEnv() {
  const envPath = path.join(process.cwd(), '.env');
  try {
    await fs.access(envPath);
    logOk('.env file exists');
    
    const content = await fs.readFile(envPath, 'utf8');
    const hasApiKey = /API_KEY\s*=/.test(content) && !/API_KEY\s*=\s*$/.test(content);
    
    if (hasApiKey) {
      logOk('API key appears to be configured');
    } else {
      logWarn('API key not configured in .env');
      console.log(`  Edit .env and add your LLM API key`);
    }
    return true;
  } catch {
    logFail('.env file not found');
    console.log(`  Run: cp .env.example .env`);
    return false;
  }
}

async function checkConfig() {
  const configPaths = [
    'config/team/roles.json',
    'config/team/governance.json',
    'config/team/tools.json',
  ];
  
  let allExist = true;
  for (const configPath of configPaths) {
    try {
      await fs.access(configPath);
      logOk(`${configPath} exists`);
    } catch {
      logFail(`${configPath} not found`);
      allExist = false;
    }
  }
  return allExist;
}

async function checkDeps() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  try {
    await fs.access(nodeModulesPath);
    logOk('Dependencies installed (node_modules exists)');
    return true;
  } catch {
    logWarn('Dependencies not installed (node_modules not found)');
    console.log(`  Run: pnpm install`);
    return false;
  }
}

async function checkDashboardDeps() {
  const dashboardModules = path.join(process.cwd(), 'dashboard', 'node_modules');
  try {
    await fs.access(dashboardModules);
    logOk('Dashboard dependencies installed');
    return true;
  } catch {
    logWarn('Dashboard dependencies not installed');
    console.log(`  Run: cd dashboard && pnpm install`);
    return false;
  }
}

async function checkPorts() {
  const ports = [3001];
  const available = [];
  
  for (const port of ports) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      logOk(`Port ${port} is available`);
      available.push(port);
    } else {
      logWarn(`Port ${port} is already in use`);
    }
  }
  
  return available.length > 0;
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('node:net');
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

async function checkLlmProvider() {
  const envPath = path.join(process.cwd(), '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    
    const providerMatch = content.match(/LLM_PROVIDER\s*=\s*(\S+)/);
    const hasApiKey = /API_KEY\s*=\s*\S+/.test(content);
    
    if (providerMatch && hasApiKey) {
      logOk(`LLM provider (${providerMatch[1]}) appears configured`);
      return true;
    } else if (!hasApiKey) {
      logWarn('LLM API key not configured');
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function runCommand(cmd, args) {
  const { execFile } = require('node:child_process');
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function printBanner() {
  console.log(`
${BOLD}╔══════════════════════════════════════════════════════════════╗
║           AI Team Runtime - Health Check                 ║
╚══════════════════════════════════════════════════════════════╝${RESET}
  `);
}

async function main() {
  printBanner();
  
  logHeader('System Requirements');
  const nodeOk = await checkNode();
  const pnpmOk = await checkPnpm();
  const dockerOk = await checkDocker();
  
  logHeader('Configuration Files');
  const configOk = await checkConfig();
  
  logHeader('Environment');
  const envOk = await checkEnv();
  const llmOk = await checkLlmProvider();
  
  logHeader('Dependencies');
  const depsOk = await checkDeps();
  const dashboardDepsOk = await checkDashboardDeps();
  
  logHeader('Network');
  const portsOk = await checkPorts();
  
  console.log('\n' + BOLD + '═══════════════════════════════════════════════════════════════' + RESET);
  
  const allCritical = nodeOk && pnpmOk && configOk && envOk && depsOk;
  const allPassed = allCritical && dockerOk && dashboardDepsOk && portsOk && llmOk;
  
  if (allPassed) {
    log('\n✅ All checks passed! You are ready to run AI Team Runtime.\n', GREEN);
    console.log('  Next steps:');
    console.log('    1. pnpm run dev          - Start development server');
    console.log('    2. make docker-start     - Start with Docker');
    console.log('    3. Visit http://localhost:3001\n');
    return 0;
  } else if (allCritical) {
    log('\n⚠️  Critical checks passed, but some optional components need attention.\n', YELLOW);
    console.log('  Run the following to fix:');
    if (!dockerOk) console.log('    - Install Docker: https://docs.docker.com/get-docker/');
    if (!dashboardDepsOk) console.log('    - cd dashboard && pnpm install');
    if (!llmOk) console.log('    - Edit .env and add your LLM API key');
    if (!portsOk) console.log('    - Stop services using port 3001 or use a different PORT');
    console.log('');
    return 0;
  } else {
    log('\n❌ Some critical checks failed. Please fix the issues above.\n', RED);
    console.log('  Quick fixes:');
    if (!nodeOk) console.log('    - Install Node.js 18+: https://nodejs.org/');
    if (!pnpmOk) console.log('    - Run: corepack enable pnpm');
    if (!envOk) console.log('    - Run: cp .env.example .env');
    if (!depsOk) console.log('    - Run: pnpm install');
    if (!configOk) console.log('    - Config files missing - reinstall may help');
    console.log('');
    return 1;
  }
}

main().catch((error) => {
  console.error('Doctor check failed:', error.message);
  process.exit(1);
});
