#!/usr/bin/env node
// Orquestador de "dev:full". Arranca Postgres/Redis, backend (api + worker),
// frontend, lambdas (watch), monitor de colas y los túneles devtunnel.
// Todo se lanza en background con prefijo en logs y se mata como árbol al salir.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const isWin = process.platform === 'win32';
const pnpmInvocation = { command: isWin ? 'pnpm.cmd' : 'pnpm', args: [] };
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const execFileAsync = promisify(execFile);
const DEV_PORTS = [3001, 3002, 4000, 5000];

function resolveDevTunnel() {
  if (!isWin) return 'devtunnel';
  const localAppData = process.env.LOCALAPPDATA;
  const packagesDir = localAppData && path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (packagesDir && existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir)) {
      if (!entry.toLowerCase().startsWith('microsoft.devtunnel_')) continue;
      const candidate = path.join(packagesDir, entry, 'devtunnel.exe');
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'devtunnel.exe';
}

const devtunnelCmd = resolveDevTunnel();

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const children = new Set();
let exiting = false;

// Procesos cuya caída NO debe tumbar dev:full (errores no-críticos).
const OPTIONAL = new Set([
  'frontend',
  'queues:monitor',
  'functions:watch',
  'sam:lambda',
  'tunnel:api',
  'tunnel:front',
]);

/**
 * Watchdog de túneles DevTunnels.
 *
 * El cliente de `devtunnel` mantiene una conexión SSH con el relay de
 * Microsoft. Esa conexión se cae sola de vez en cuando (rotación de
 * certificados, pérdida de NAT, sleep del equipo, etc.) y, mientras lo
 * hace, todas las requests a la URL pública devuelven un error de
 * transporte sin headers CORS, lo que el navegador presenta como
 * "CORS error" aunque el problema es la red.
 *
 * Este vigía hace `fetch` periódico a una URL pública de cada túnel
 * (la raíz de la API y la home del frontend). Si la respuesta no
 * llega (timeout, ECONNRESET, 5xx), mata el proceso `devtunnel` que
 * sirve ese puerto y lo relanza. El backend/front siguen vivos en
 * localhost; solo se reconstruye el puente hacia el exterior.
 *
 * Estado: cada túnel guarda su `child` y `sinceLastFailure`. No se
 * reinicia si la caída lleva menos de `confirmDownMs` (backoff).
 */
const TUNNEL_WATCHDOG = {
  // ms entre checks.
  intervalMs: 15000,
  // ms de timeout para cada fetch.
  fetchTimeoutMs: 5000,
  // ms de gracia después de lanzar el túnel antes de empezar a
  // chequear (la conexión SSH tarda unos segundos en establecerse).
  initialGraceMs: 20000,
  // ms para tratar una caída como "estable" antes de reiniciar.
  // Evita falsos positivos si el túnel se está negociando.
  confirmDownMs: 30000,
  // URLs públicas y puertos locales que atacan cada túnel.
  targets: [
    {
      name: 'tunnel:api',
      publicUrl: 'https://7q5jvs7s-3001.use2.devtunnels.ms',
      localPort: 3001,
      child: null,
      sinceLastFailure: 0,
    },
    {
      name: 'tunnel:front',
      publicUrl: 'https://v8p92mlf-4000.use.devtunnels.ms',
      localPort: 4000,
      child: null,
      sinceLastFailure: 0,
    },
  ],
};

function findWatchdogTarget(name) {
  return TUNNEL_WATCHDOG.targets.find((t) => t.name === name);
}

function prefixColor(name) {
  const palette = ['\x1b[36m', '\x1b[35m', '\x1b[33m', '\x1b[32m', '\x1b[34m'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function runShell(command, args, name, options = {}) {
  const color = prefixColor(name);
  const needsShell = isWin && /\.(cmd|bat)$/i.test(command);
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Grupo propio para que Ctrl+C llegue al orquestador y este pueda cerrar
    // explícitamente el árbol completo de cada servicio en Windows.
    detached: !isWin,
    // Los wrappers .cmd se ejecutan a través de cmd.exe oculto, sin shell
    // adicional; así no se abren ventanas de terminal visibles.
    shell: needsShell,
    windowsHide: true,
  });
  children.add(child);

  const tag = `${color}[${name}]${colors.reset}`;
  const pipe = (stream) => (data) => {
    const text = data.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.length === 0) continue;
      console.log(`${colors.dim}${tag}${colors.reset} ${line}`);
    }
  };
  child.stdout.on('data', pipe('stdout'));
  child.stderr.on('data', pipe('stderr'));

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (exiting) return;
    const codeLabel = code === null ? 'killed' : code;
    console.log(
      `${tag} ${colors.yellow}salió${colors.reset} code=${codeLabel ?? '-'} signal=${signal ?? '-'}`,
    );
    // Solo procesos críticos (backend) tumban dev:full al fallar.
    // Los opcionales (frontend, sam, tunnels, monitor) registran el fallo y siguen.
    if (
      code !== 0 &&
      code !== null &&
      !signal &&
      !OPTIONAL.has(name)
    ) {
      shutdown(code);
    }
  });

  // Si el comando no existe (sam/devtunnel no instalados), no abortar.
  child.on('error', (err) => {
    console.log(
      `${tag} ${colors.yellow}no se pudo iniciar${colors.reset} (${err.message})`,
    );
  });

  return child;
}

function npx(args, name, options = {}) {
  const child = runShell(devtunnelCmd, args, name, options);
  // Si el nombre coincide con un túnel conocido, registramos el child
  // para que el watchdog pueda matarlo cuando detecte una caída.
  const target = findWatchdogTarget(name);
  if (target) target.child = child;
  return child;
}

function pnpm(script, name, cwd) {
  return runShell(pnpmInvocation.command, [...pnpmInvocation.args, '--silent', 'run', script], name, cwd ? { cwd } : {});
}

// Lanza nest --watch con un tsconfig independiente (outDir separado).
// Evita EPERM en Windows cuando dos procesos compilan en el mismo dist/.
function nestWatch(entryFile, tsconfig, name, cwd) {
  return runShell(
    npxCmd,
    ['--no-install', 'nest', 'start', '--watch', '-p', tsconfig, '--entryFile', entryFile],
    name,
    { cwd },
  );
}

function pnpmInfra(name) {
  return runShell(pnpmInvocation.command, [...pnpmInvocation.args, '--silent', 'infra:up'], name);
}

let rootScriptsCache = null;
function hasRootScript(name) {
  if (rootScriptsCache === null) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      rootScriptsCache = pkg.scripts ?? {};
    } catch {
      rootScriptsCache = {};
    }
  }
  return Object.prototype.hasOwnProperty.call(rootScriptsCache, name);
}

async function listeningPids(port) {
  if (isWin) {
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true });
      const pids = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
        if (match && Number(match[1]) === port) pids.add(Number(match[2]));
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN']);
    return [...new Set(stdout.split(/\s+/).filter(Boolean).map(Number))];
  } catch {
    return [];
  }
}

async function killProcessTree(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (isWin) {
      await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // El proceso pudo terminar entre netstat y taskkill.
  }
}

async function projectProcessPids() {
  if (!isWin) return [];
  const escapedRoot = root.replaceAll("'", "''");
  const command = `$root='${escapedRoot}'; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.CommandLine -and $_.CommandLine -like \"*$root*\" } | Select-Object -ExpandProperty ProcessId`;
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      command,
    ], { windowsHide: true });
    return [...new Set(stdout.split(/\r?\n/).map((value) => Number(value.trim())).filter(Boolean))];
  } catch {
    return [];
  }
}

async function cleanupDevPorts(reason) {
  console.log(`${colors.cyan}[dev:full]${colors.reset} limpiando puertos ${DEV_PORTS.join(', ')} (${reason})`);
  const pids = new Set();
  if (reason === 'inicio') {
    for (const pid of await projectProcessPids()) pids.add(pid);
  }
  for (const port of DEV_PORTS) {
    for (const pid of await listeningPids(port)) pids.add(pid);
  }
  await Promise.all([...pids].map(killProcessTree));

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const remaining = (await Promise.all(DEV_PORTS.map(listeningPids))).flat();
    if (remaining.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  console.log(`${colors.yellow}[dev:full]${colors.reset} algunos puertos siguen ocupados; se continuarÃ¡ igualmente`);
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', () => resolve({ code: null, signal: null }));
  });
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

async function startIfPortFree(port, name, start) {
  if (await isPortOpen(port)) {
    console.log(
      `${colors.yellow}[${name}]${colors.reset} puerto ${port} ya está en uso; se reutiliza el proceso existente`,
    );
    return false;
  }
  start();
  return true;
}

function spawnDirect(command, args, name, options = {}) {
  return runShell(command, args, name, options);
}

/**
 * Sondea una URL hasta que responda con status < 500 o se agote el
 * timeout.
 *
 * Default 5 minutos: en máquinas con poco I/O (discos HDD, antivirus
 * activo, primer encendido con caché fría), la API de Nest puede
 * tardar bien más que los 50s originales en compilar y quedar lista.
 *
 * Mientras espera, emite un mensaje cada 15s para que el usuario
 * sepa que sigue intentando y no parece colgado.
 *
 * Devuelve `true` si la URL respondió, `false` si se agotó el
 * timeout. Para servicios críticos (backend:api) el caller decide
 * si tirar `dev:full` abajo; para servicios opcionales suele
 * aceptar el `false` y continuar.
 */
async function waitForHttp(url, name, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  const tickInterval = 15000;
  let lastTick = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status < 500) return true;
    } catch {}
    const elapsed = Date.now() - start;
    if (elapsed - lastTick >= tickInterval) {
      lastTick = elapsed;
      const secs = Math.floor(elapsed / 1000);
      console.log(
        `${colors.dim}[${name}]${colors.reset} esperando ${secs}s… (timeout en ${Math.floor(timeoutMs / 1000)}s)`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(
    `${colors.yellow}[${name}]${colors.reset} no respondió en ${timeoutMs}ms, pero continuamos`,
  );
  return false;
}

async function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  console.log(`\n${colors.cyan}dev:full${colors.reset} apagando procesos…`);
  await Promise.all([...children].map((child) => killProcessTree(child.pid)));
  await cleanupDevPorts('cierre');
  process.exit(code);
}

function registerShutdown() {
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => shutdown(0));
  }
}

/**
 * Sonda el destino local (localhost:port) del túnel antes que la
 * URL pública. Si el destino local NO está escuchando, NO es un
 * problema del túnel sino del servicio de atrás, y no conviene
 * reiniciar el proceso del túnel (gasta el sleep del SSH forward
 * y no soluciona nada).
 */
async function probeLocalTarget(target) {
  if (!target.localPort) return true;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    TUNNEL_WATCHDOG.fetchTimeoutMs,
  );
  try {
    // Conexión TCP pura: si el puerto está abierto, el servicio
    // detrás está vivo. No hace falta hablar HTTP.
    const ok = await new Promise((resolve) => {
      const socket = net.createConnection({
        host: '127.0.0.1',
        port: target.localPort,
      });
      const finish = (result) => {
        socket.destroy();
        resolve(result);
      };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      controller.signal.addEventListener('abort', () => finish(false));
    });
    return ok;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sonda la URL pública de un túnel. Devuelve `{ ok, status }` cuando
 * la respuesta llega (status < 500). Si la conexión falla
 * (timeout, DNS, ECONNRESET, etc.) devuelve `{ ok: false, error }`.
 */
async function probeTunnel(target) {
  // Si el destino local está caído, el túnel no es el problema.
  // Devolvemos ok=false con `error: 'local-down'` para que el
  // watchdog lo registre pero no reinicie el túnel.
  const localOk = await probeLocalTarget(target);
  if (!localOk) return { ok: false, error: 'local-down' };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    TUNNEL_WATCHDOG.fetchTimeoutMs,
  );
  try {
    const res = await fetch(target.publicUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    // 200 del front, 404 del backend (que no tiene ruta raíz).
    // Lo que nos interesa es detectar 5xx del relay, que sí
    // indican que el túnel se quedó sin respuesta hacia atrás.
    return { ok: res.status < 500, status: res.status };
  } catch (err) {
    return { ok: false, error: err.name || err.message };
  } finally {
    clearTimeout(timer);
  }
}

function killTunnelChild(target) {
  if (!target.child || target.child.exitCode !== null) return;
  try {
    if (isWin) {
      // `devtunnel host` corre como proceso independiente del spawn
      // del orquestador; matamos el árbol completo con taskkill.
      execFile(
        'taskkill.exe',
        ['/PID', String(target.child.pid), '/T', '/F'],
        { windowsHide: true },
        () => {},
      );
    } else {
      target.child.kill('SIGTERM');
    }
  } catch {
    // ignore
  }
}

function startTunnelChild(target) {
  const tunnelId = target.name === 'tunnel:api' ? 'sss-api.use2' : 'sss-front.use';
  // npx() ya registra el child en `target.child` por nombre.
  npx(['host', tunnelId], target.name);
}

/**
 * Lanza el watchdog. Cada `intervalMs` sondea cada túnel y, si
 * una URL está caída por más de `confirmDownMs`, mata el proceso
 * y lo arranca de nuevo. No aborta `dev:full` si algo falla.
 */
function startTunnelWatchdog() {
  if (!TUNNEL_WATCHDOG.targets.length) return;

  const startedAt = Date.now();

  const tick = async () => {
    if (exiting) return;
    // Respetar la gracia inicial para no reiniciar mientras el túnel
    // está negociando el SSH con el relay.
    if (Date.now() - startedAt < TUNNEL_WATCHDOG.initialGraceMs) return;

    for (const target of TUNNEL_WATCHDOG.targets) {
      const probe = await probeTunnel(target);
      if (probe.ok) {
        target.sinceLastFailure = 0;
        continue;
      }

      // Si el problema es del servicio local (no del túnel), no
      // reiniciamos el túnel: solo registramos y dejamos que el
      // servicio de atrás termine de levantarse / se recupere solo.
      if (probe.error === 'local-down') {
        target.sinceLastFailure = 0;
        console.log(
          `${colors.dim}[watchdog]${colors.reset} ${target.name}: destino local localhost:${target.localPort} no está escuchando aún; no se reinicia el túnel`,
        );
        continue;
      }

      if (target.sinceLastFailure === 0) {
        target.sinceLastFailure = Date.now();
        console.log(
          `${colors.yellow}[watchdog]${colors.reset} ${target.name} sin respuesta (${probe.status ?? probe.error}) — observando ${TUNNEL_WATCHDOG.confirmDownMs}ms antes de reiniciar`,
        );
        continue;
      }

      if (Date.now() - target.sinceLastFailure < TUNNEL_WATCHDOG.confirmDownMs) {
        continue;
      }

      // Confirmado: túnel caído. Reiniciar.
      console.log(
        `${colors.red}[watchdog]${colors.reset} ${target.name} confirmado caído. Reiniciando…`,
      );
      killTunnelChild(target);
      target.sinceLastFailure = 0;
      // Pequeño delay para que taskkill termine antes de arrancar
      // un nuevo devtunnel.
      setTimeout(() => startTunnelChild(target), 1500);
    }
  };

  setInterval(tick, TUNNEL_WATCHDOG.intervalMs);
  // Primer chequeo tras la gracia inicial.
  setTimeout(tick, TUNNEL_WATCHDOG.initialGraceMs);
}

async function main() {
  registerShutdown();
  await cleanupDevPorts('inicio');

  const step = async (label, fn) => {
    console.log(`${colors.green}▶ ${label}${colors.reset}`);
    await fn();
  };

  await step('Infra (postgres + redis)', () => {
    const child = pnpmInfra('infra');
    return waitForExit(child).then(({ code }) => {
      if (code !== 0) throw new Error(`infra:up terminó con código ${code ?? 'desconocido'}`);
    });
  });

  // Limpia cualquier dist/ a medio compilar antes de lanzar watchers.
  // Evita EPERM cuando un dist previo quedó con archivos a medio escribir.
  await step('Limpiando dist/ del backend', async () => {
    const backendDir = path.join(root, 'apps/backend');
    const candidates = ['dist', 'dist-worker'];
    for (const dir of candidates) {
      const target = path.join(backendDir, dir);
      if (!existsSync(target)) continue;
      try {
        runShell('cmd.exe', ['/c', 'rmdir', '/S', '/Q', target], `clean:${dir}`);
        // Espera breve para que termine el rmdir antes de lanzar nest.
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.log(
          `${colors.yellow}[clean:${dir}]${colors.reset} no se pudo limpiar (${err.message})`,
        );
      }
    }
  });

  await step('Backend API (nest --watch)', () => {
    return startIfPortFree(3001, 'backend:api', () =>
      pnpm('dev', 'backend:api', path.join(root, 'apps/backend')),
    );
  });

  await step('Backend worker (bullmq, tsconfig.worker.json)', () => {
    pnpm('dev:worker:isolated', 'backend:worker', path.join(root, 'apps/backend'));
  });

  // 5 min de gracia para que la API arranque. En máquinas con poco
  // I/O puede tardar más que los 50s que teníamos antes.
  if (
    !(await waitForHttp('http://localhost:3001/api', 'backend:api', 5 * 60 * 1000))
  ) {
    throw new Error(
      'La API no quedó disponible en http://localhost:3001/api en 5 minutos. ' +
        'Revisá los logs de [backend:api] para ver si falló la compilación.',
    );
  }

  await step('Frontend (next dev --port 4000)', () => {
    return startIfPortFree(4000, 'frontend', () =>
      pnpm('dev', 'frontend', path.join(root, 'apps/frontend')),
    );
  });

  // Espera a que el frontend esté realmente escuchando en :4000 antes de
  // levantar el túnel. Si se levanta el túnel antes de tiempo, el relé
  // SSH intenta hablar con localhost:4000 y falla con
  // `PortForwardingService connection to localhost:4000 failed`. Esa
  // falla la detecta el watchdog y reinicia el túnel, pero es ruido
  // innecesario y, en la práctica, hacía que el túnel del front
  // quedara en estado de "Connection to host tunnel relay restored"
  // sin tráfico legítimo durante varios segundos.
  if (!(await waitForHttp('http://localhost:4000', 'frontend', 5 * 60 * 1000))) {
    throw new Error(
      'El frontend no quedó disponible en http://localhost:4000 en 5 minutos. ' +
        'Revisá los logs de [frontend] para ver si falló la compilación.',
    );
  }

  await step('Lambdas (functions tsc --watch + SAM local)', () => {
    pnpm('dev', 'functions:watch', path.join(root, 'apps/functions'));
  });

  if (existsSync(path.join(root, 'infra/sam'))) {
    await step('SAM local (start-lambda)', () => {
      const cmd = isWin ? 'sam.cmd' : 'sam';
      return startIfPortFree(3002, 'sam:lambda', () =>
        spawnDirect(
          cmd,
          ['local', 'start-lambda', '--port', '3002'],
          'sam:lambda',
          { cwd: path.join(root, 'infra/sam') },
        ),
      );
    });
  } else {
    console.log(`${colors.dim}[sam] no se encontró infra/sam, se omite${colors.reset}`);
  }

  await step('Queue monitor (bullmq dashboard)', () => {
    if (!hasRootScript('queues:monitor')) {
      console.log(
        `${colors.dim}[queues:monitor]${colors.reset} script no definido en package.json raíz; se omite`,
      );
      return Promise.resolve();
    }
    return startIfPortFree(5000, 'queues:monitor', () =>
      runShell(pnpmInvocation.command, [...pnpmInvocation.args, '--silent', 'queues:monitor'], 'queues:monitor'),
    );
  });

  await step('Túnel backend (sss-api.use2)', () => {
    npx(['host', 'sss-api.use2'], 'tunnel:api');
  });

  await step('Túnel frontend (sss-front.use)', () => {
    npx(['host', 'sss-front.use'], 'tunnel:front');
  });

  // Watchdog que detecta caídas del SSH de DevTunnels y reinicia
  // el túnel correspondiente sin matar el resto de dev:full.
  startTunnelWatchdog();

  console.log(
    `${colors.green}✓ dev:full arriba${colors.reset} — Ctrl+C para detener todo.`,
  );

  // Mantener vivo
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(`${colors.red}dev:full falló${colors.reset}`, err);
  shutdown(1);
});
