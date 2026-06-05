#!/usr/bin/env node
/**
 * Audit Lighthouse sur le build de production (preview local).
 * Usage : bun run lighthouse
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const browserCacheDir = join(projectRoot, '.cache', 'browsers');
const lighthouseChromeProfileDir = join(projectRoot, '.cache', 'lighthouse-chrome');

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:4173';
const PORT = process.env.PORT ?? '4173';
const HOST = process.env.HOST ?? '0.0.0.0';
const REPORT_PATH = process.env.LH_REPORT ?? '.lighthouse-report.json';

function isWsl() {
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

/** Chrome Windows via /mnt/c ne fonctionne pas avec chrome-launcher sous WSL (ECONNREFUSED). */
function getChromeCandidates() {
  if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];

  const linux = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium'
  ];

  if (isWsl()) return linux;

  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
  }

  return [
    ...linux,
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ];
}

async function trySystemChrome() {
  try {
    const { Browser, computeSystemExecutablePath } = await import('@puppeteer/browsers');
    return computeSystemExecutablePath({ browser: Browser.CHROME, channel: 'stable' });
  } catch {
    return null;
  }
}

async function resolvePuppeteerChrome() {
  const {
    Browser,
    computeExecutablePath,
    detectBrowserPlatform,
    install,
    resolveBuildId
  } = await import('@puppeteer/browsers');

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error('Plateforme navigateur non supportée pour le téléchargement Chromium.');
  }

  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
  const executablePath = computeExecutablePath({
    browser: Browser.CHROME,
    platform,
    buildId,
    cacheDir: browserCacheDir
  });

  if (!existsSync(executablePath)) {
    console.log('Téléchargement de Chromium pour Lighthouse…');
    await install({
      browser: Browser.CHROME,
      platform,
      buildId,
      cacheDir: browserCacheDir
    });
  }

  return executablePath;
}

async function resolveChromePath() {
  for (const candidate of getChromeCandidates()) {
    if (existsSync(candidate)) return candidate;
  }

  const systemChrome = await trySystemChrome();
  if (systemChrome && existsSync(systemChrome)) return systemChrome;

  return resolvePuppeteerChrome();
}

const preview = spawn('node', ['--env-file=.env', 'build/index.js'], {
  env: { ...process.env, ORIGIN, PORT, HOST },
  stdio: ['ignore', 'pipe', 'pipe']
});

let previewReady = false;

preview.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!previewReady && /listening|started|Local:/i.test(text)) {
    previewReady = true;
  }
});

preview.stderr.on('data', (chunk) => process.stderr.write(chunk));

const stopPreview = () => {
  if (!preview.killed) preview.kill('SIGTERM');
};

process.on('SIGINT', () => {
  stopPreview();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopPreview();
  process.exit(143);
});

const CHROME_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-extensions'
];

async function killChromeInstance(chrome) {
  try {
    await Promise.race([chrome.kill(), delay(5000)]);
  } catch {
    // chrome-launcher kill peut échouer si le processus est déjà mort
  }
}

async function runLighthouse(chromePath) {
  const chromeLauncher = await import('chrome-launcher');
  const lighthouse = (await import('lighthouse')).default;

  rmSync(lighthouseChromeProfileDir, { recursive: true, force: true });

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: CHROME_FLAGS,
    userDataDir: lighthouseChromeProfileDir,
    connectionPollInterval: 250,
    maxConnectionRetries: 60
  });

  try {
    const result = await lighthouse(ORIGIN, {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port
    });

    if (!result?.lhr) {
      throw new Error('Rapport Lighthouse vide');
    }

    writeFileSync(REPORT_PATH, result.report);
    return result.lhr;
  } finally {
    await killChromeInstance(chrome);
    rmSync(lighthouseChromeProfileDir, { recursive: true, force: true });
  }
}

try {
  const chromePath = await resolveChromePath();
  console.log(`Chrome : ${chromePath}`);

  for (let i = 0; i < 60 && !previewReady; i++) {
    try {
      const res = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) {
        previewReady = true;
        break;
      }
    } catch {
      // serveur pas encore prêt
    }
    await delay(500);
  }

  if (!previewReady) {
    throw new Error(`Le serveur preview n’a pas répondu sur ${ORIGIN}`);
  }

  const report = await runLighthouse(chromePath);
  console.log(`\nRapport écrit dans ${REPORT_PATH}\n`);

  for (const [id, category] of Object.entries(report.categories)) {
    console.log(`${id}: ${Math.round(category.score * 100)}`);
  }

  const metrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive'
  ];

  for (const id of metrics) {
    const audit = report.audits[id];
    if (audit) {
      console.log(`  ${id}: ${audit.displayValue ?? audit.title}`);
    }
  }
} catch (error) {
  console.error(error);
  if (isWsl()) {
    console.error(
      [
        '',
        'Sous WSL, Chrome Windows (/mnt/c/...) ne peut pas être piloté par Node.',
        'Options :',
        '  sudo apt install chromium-browser',
        '  ou laisser le script télécharger Chromium automatiquement (défaut).'
      ].join('\n')
    );
  }
  process.exitCode = 1;
} finally {
  stopPreview();
}
