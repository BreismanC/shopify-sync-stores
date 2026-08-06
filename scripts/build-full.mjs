#!/usr/bin/env node
// Construye el monorepo y levanta la aplicación compilada junto con la
// infraestructura local y los túneles DevTunnels.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';
const npx = isWin ? 'npx.cmd' : 'npx';
const execFileAsync = promisify(execFile);
const ports = [3001, 3002, 4000, 5000];
const children = new Set();
let exiting = false;

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function prefixColor(name) {
  const palette = ['\x1b[36m', '\x1b[35m', '\x1b[33m', '\x1b[32m', '\x1b[34m'];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function run(command, args, name, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWin,
    shell: isWin && /\.(cmd|bat)$/i.test(command),
    windowsHide: true,
  });
  children.add(child);
  const tag = `${prefixColor(name)}[${name}]${colors.reset}`;
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => {
      for (const line of data.toString().split(/\r?\n/)) {
        if (line) console.log(`${colors.dim}${tag}${colors.reset} ${line}`);
      }
    });
  }
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!exiting && code !== 0 && code !== null && !signal && !options.optional) {
      shutdown(code);
    }
  });
  child.on('error', (error) => {
    console.log(`${colors.yellow}${tag} no se pudo iniciar: ${error.message}${colors.reset}`);
  });
  return child;
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', () => resolve({ code: null, signal: null }));
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

async function waitForHttp(url, name, timeoutMs = 5 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} no quedó disponible en ${url}`);
}

async function listeningPids(port) {
  if (isWin) {
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true });
      return [...new Set(stdout.split(/\r?\n/).flatMap((line) => {
        const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
        return match && Number(match[1]) === port ? [Number(match[2])] : [];
      }))];
    } catch {
      return [];
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN']);
    return stdout.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

async function killTree(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (isWin) await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-pid, 'SIGTERM');
  } catch {}
}

async function cleanupPorts() {
  const pids = new Set((await Promise.all(ports.map(listeningPids))).flat());
  await Promise.all([...pids].map(killTree));
}

async function startOnFreePort(port, name, command, args, options = {}) {
  if (await isPortOpen(port)) {
    console.log(`${colors.yellow}[${name}]${colors.reset} puerto ${port} ya está en uso; se reutiliza`);
    return null;
  }
  return run(command, args, name, options);
}

function resolveDevTunnel() {
  if (!isWin) return 'devtunnel';
  const packages = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  if (packages && existsSync(packages)) {
    // La instalación de WinGet puede variar de versión; el ejecutable del PATH
    // sigue siendo el fallback más portable.
    const match = readdirSync(packages).find((entry) => entry.toLowerCase().startsWith('microsoft.devtunnel_'));
    if (match) {
      const candidate = path.join(packages, match, 'devtunnel.exe');
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'devtunnel.exe';
}

async function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  await Promise.all([...children].map((child) => killTree(child.pid)));
  await cleanupPorts();
  process.exit(code);
}

async function main() {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));
  await cleanupPorts();

  console.log(`${colors.green}▶ Build de todos los paquetes${colors.reset}`);
  const build = run(pnpm, ['--silent', 'build'], 'build');
  const result = await waitForExit(build);
  if (result.code !== 0) throw new Error(`pnpm build terminó con código ${result.code ?? 'desconocido'}`);

  // El worker usa un tsconfig/outDir separado y no lo genera el build normal
  // de Nest; se compila aquí para poder ejecutarlo como proceso productivo.
  console.log(`${colors.green}▶ Build del worker${colors.reset}`);
  const workerBuild = run(
    pnpm,
    ['--silent', 'exec', 'nest', 'build', '-p', 'tsconfig.worker.json'],
    'build:worker',
    { cwd: path.join(root, 'apps/backend') },
  );
  const workerResult = await waitForExit(workerBuild);
  if (workerResult.code !== 0) throw new Error(`build del worker terminó con código ${workerResult.code ?? 'desconocido'}`);

  console.log(`${colors.green}▶ Infra (postgres + redis)${colors.reset}`);
  const infra = run(pnpm, ['--silent', 'infra:up'], 'infra');
  const infraResult = await waitForExit(infra);
  if (infraResult.code !== 0) throw new Error(`infra:up terminó con código ${infraResult.code ?? 'desconocido'}`);

  await startOnFreePort(3001, 'backend:api', pnpm, ['--silent', 'start:prod'], { cwd: path.join(root, 'apps/backend') });
  await startOnFreePort(4000, 'frontend', pnpm, ['--silent', 'exec', 'next', 'start', '--port', '4000'], { cwd: path.join(root, 'apps/frontend') });

  await waitForHttp('http://localhost:3001/api', 'backend:api');
  await waitForHttp('http://localhost:4000', 'frontend');

  const worker = path.join(root, 'apps/backend', 'dist-worker', 'src', 'worker.js');
  if (existsSync(worker)) run(process.execPath, [worker], 'backend:worker', { cwd: path.join(root, 'apps/backend') });

  if (existsSync(path.join(root, 'infra/sam'))) {
    const sam = isWin ? 'sam.cmd' : 'sam';
    await startOnFreePort(3002, 'sam:lambda', sam, ['local', 'start-lambda', '--port', '3002'], {
      cwd: path.join(root, 'infra/sam'), optional: true,
    });
  }

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.scripts?.['queues:monitor']) {
    await startOnFreePort(5000, 'queues:monitor', pnpm, ['--silent', 'queues:monitor'], { optional: true });
  }

  const tunnel = resolveDevTunnel();
  run(tunnel, ['host', 'sss-api.use2'], 'tunnel:api', { optional: true });
  run(tunnel, ['host', 'sss-front.use'], 'tunnel:front', { optional: true });

  console.log(`${colors.green}✓ build:full arriba${colors.reset} — Ctrl+C para detener todo.`);
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error(`${colors.red}build:full falló${colors.reset}`, error);
  shutdown(1);
});
