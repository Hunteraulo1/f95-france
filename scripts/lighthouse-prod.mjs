#!/usr/bin/env node
/**
 * Audit Lighthouse sur le build de production (preview local).
 * Usage : bun run lighthouse
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/** Sous WSL/Linux, les chemins UNC Windows (`\\wsl.localhost\...`) deviennent un nom de dossier littéral. */
function toFsPath(path) {
	if (process.platform === 'win32') return path;
	return path.replace(/\\/g, '/');
}

function resolveProjectRoot() {
	const fromScript = resolve(toFsPath(dirname(fileURLToPath(import.meta.url))), '..');
	const hasPackageJson = existsSync(join(fromScript, 'package.json'));

	if (hasPackageJson && !fromScript.includes('\\')) {
		return fromScript;
	}

	const cwd = resolve(toFsPath(process.cwd()));
	if (existsSync(join(cwd, 'package.json'))) {
		if (!hasPackageJson) {
			console.warn(
				'Chemin projet détecté via le répertoire courant (évite les chemins UNC Windows sous WSL).'
			);
		}
		return cwd;
	}

	if (fromScript.includes('\\') || /wsl\.localhost/i.test(fromScript)) {
		throw new Error(
			[
				'Chemin projet invalide sous WSL/Linux :',
				fromScript,
				'',
				'Lancez « bun run lighthouse » depuis un terminal WSL dans le projet,',
				'pas depuis PowerShell/CMD avec un chemin \\\\wsl.localhost\\....'
			].join('\n')
		);
	}

	return fromScript;
}

const projectRoot = resolveProjectRoot();
const browserCacheDir = join(projectRoot, '.cache', 'browsers');
const lighthouseChromeProfileDir = join(projectRoot, '.cache', 'lighthouse-chrome');

function removeMalformedLighthouseDirs() {
	if (process.platform === 'win32') return;

	for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (!/wsl\.localhost/i.test(entry.name) && !entry.name.includes('\\')) continue;

		const target = join(projectRoot, entry.name);
		rmSync(target, { recursive: true, force: true });
		console.warn(`Dossier Lighthouse malformé supprimé : ${entry.name}`);
	}
}

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
	const { Browser, computeExecutablePath, detectBrowserPlatform, install, resolveBuildId } =
		await import('@puppeteer/browsers');

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

const DEBUG_HOST = '127.0.0.1';

function prepareChromeProfileDir() {
	removeMalformedLighthouseDirs();
	rmSync(lighthouseChromeProfileDir, { recursive: true, force: true });
	mkdirSync(lighthouseChromeProfileDir, { recursive: true });
}

/**
 * On lance Chrome nous-mêmes au lieu d’utiliser `chrome-launcher` : sous WSL ce dernier
 * convertit le `userDataDir` Linux en chemin Windows (`wslpath -w`), ce qui crée des dossiers
 * parasites (`\\wsl.localhost\...` ou `C:\…\lighthouse.XXXX`) car notre Chromium est un binaire Linux.
 */
function spawnChrome(chromePath) {
	return spawn(
		chromePath,
		[
			...CHROME_FLAGS,
			`--user-data-dir=${lighthouseChromeProfileDir}`,
			'--remote-debugging-port=0',
			'about:blank'
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);
}

/** Chrome écrit « DevTools listening on ws://127.0.0.1:PORT/… » sur stderr au démarrage. */
function readDebugPort(child, timeoutMs = 30000) {
	return new Promise((resolvePort, reject) => {
		let buffer = '';
		const cleanup = () => {
			clearTimeout(timer);
			child.stderr.off('data', onData);
			child.off('exit', onExit);
		};
		const onData = (chunk) => {
			buffer += chunk.toString();
			const match = buffer.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
			if (match) {
				cleanup();
				resolvePort(Number(match[1]));
			}
		};
		const onExit = (code) => {
			cleanup();
			reject(new Error(`Chrome s’est arrêté (code ${code}) avant d’exposer le port DevTools.`));
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error('Délai dépassé : port DevTools introuvable.'));
		}, timeoutMs);
		child.stderr.on('data', onData);
		child.on('exit', onExit);
	});
}

async function waitForDebuggerReady(port, timeoutMs = 30000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://${DEBUG_HOST}:${port}/json/version`, {
				signal: AbortSignal.timeout(2000)
			});
			if (res.ok) return;
		} catch {
			// débogueur pas encore prêt
		}
		await delay(250);
	}
	throw new Error('Le débogueur Chrome n’a pas répondu à temps.');
}

function killChrome(child) {
	return new Promise((resolveKill) => {
		if (child.exitCode !== null || child.signalCode !== null) {
			resolveKill();
			return;
		}
		const timer = setTimeout(() => {
			try {
				child.kill('SIGKILL');
			} catch {
				/* déjà mort */
			}
			resolveKill();
		}, 5000);
		child.once('exit', () => {
			clearTimeout(timer);
			resolveKill();
		});
		try {
			child.kill('SIGTERM');
		} catch {
			clearTimeout(timer);
			resolveKill();
		}
	});
}

async function runLighthouse(chromePath) {
	const lighthouse = (await import('lighthouse')).default;

	prepareChromeProfileDir();

	const chrome = spawnChrome(chromePath);

	try {
		const port = await readDebugPort(chrome);
		await waitForDebuggerReady(port);
		chrome.stderr.resume(); // évite que le buffer stderr ne sature pendant l’audit

		const result = await lighthouse(ORIGIN, {
			logLevel: 'error',
			output: 'json',
			onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
			port
		});

		if (!result?.lhr) {
			throw new Error('Rapport Lighthouse vide');
		}

		writeFileSync(REPORT_PATH, result.report);
		return result.lhr;
	} finally {
		await killChrome(chrome);
		rmSync(lighthouseChromeProfileDir, { recursive: true, force: true });
		removeMalformedLighthouseDirs();
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

	const mainThreadAudits = [
		'mainthread-work-breakdown',
		'long-tasks',
		'bootup-time',
		'third-party-summary'
	];

	for (const id of mainThreadAudits) {
		const audit = report.audits[id];
		if (!audit?.details?.items?.length) continue;

		console.log(`\n--- ${audit.title} ---`);
		if (audit.displayValue) console.log(audit.displayValue);

		const items = [...audit.details.items]
			.map((item) => ({
				label:
					item.group ??
					item.source ??
					item.url ??
					item.scripting ??
					item.taskName ??
					item.duration ??
					item.label ??
					'—',
				ms: item.duration ?? item.blockingTime ?? item.total ?? item.scripting ?? 0
			}))
			.sort((a, b) => b.ms - a.ms)
			.slice(0, 12);

		for (const row of items) {
			const ms = typeof row.ms === 'number' ? `${Math.round(row.ms)} ms` : String(row.ms);
			console.log(`  ${ms.padStart(8)}  ${row.label}`);
		}
	}
} catch (error) {
	console.error(error);
	const message = error instanceof Error ? error.message : String(error);
	const wslChromeIssue =
		isWsl() &&
		(/ECONNREFUSED|Chrome.*not.*found|No Chrome installations found/i.test(message) ||
			/\/mnt\/c\/.*chrome/i.test(message));
	if (wslChromeIssue) {
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
