<script lang="ts">
	import { onMount } from 'svelte';
	/** Bundle UMD du paquet npm `redoc` — résolu par Vite vers un asset versionné. */
	import redocStandaloneUrl from 'redoc/bundles/redoc.standalone.js?url';

	let container = $state<HTMLDivElement | null>(null);

	const SPEC_URL = '/api/openapi-public.yaml';
	const SCRIPT_MARK = 'data-f95-redoc';

	/** https://redocly.com/docs/redoc/config */
	function baseRedocOptions(): Record<string, unknown> {
		return {
			hideDownloadButtons: false,
			nativeScrollbars: true,
			sanitize: true,
			labels: {
				enum: 'Énumération',
				enumSingleValue: 'Valeur',
				enumArray: 'Éléments',
				default: 'Défaut',
				deprecated: 'Obsolète',
				example: 'Exemple',
				examples: 'Exemples',
				recursive: 'Récursif',
				arrayOf: 'Tableau de ',
				webhook: 'Événement',
				const: 'Constante',
				noResultsFound: 'Aucun résultat',
				download: 'Télécharger',
				downloadSpecification: 'Télécharger la spécification OpenAPI',
				responses: 'Réponses',
				callbackResponses: 'Réponses de rappel',
				requestSamples: 'Exemples de requête',
				responseSamples: 'Exemples de réponse'
			}
		};
	}

	/**
	 * Redoc / polished n’accepte que des couleurs parsables (souvent hex/rgb).
	 * Les navigateurs peuvent renvoyer d’autres espaces (ex. display-p3) → crash polished #5.
	 */
	function toHex6(input: string, fallback: string): string {
		const fb = /^#[0-9a-fA-F]{6}$/.test(fallback) ? fallback : '#333333';
		const t = input.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
		if (/^#[0-9a-fA-F]{3}$/.test(t)) {
			return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
		}
		const comma = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
		const space = t.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\b/);
		const m = comma || space;
		if (m) {
			const r = Math.round(Math.min(255, Math.max(0, parseFloat(m[1]))));
			const g = Math.round(Math.min(255, Math.max(0, parseFloat(m[2]))));
			const b = Math.round(Math.min(255, Math.max(0, parseFloat(m[3]))));
			return ('#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')).toLowerCase();
		}
		return fb;
	}

	function resolveThemeColor(varName: string, fallbackHex: string): string {
		const host = document.createElement('div');
		host.style.cssText =
			'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
		const span = document.createElement('span');
		span.style.color = fallbackHex;
		span.style.color = `var(${varName}, ${fallbackHex})`;
		host.appendChild(span);
		document.body.appendChild(host);
		const resolved = getComputedStyle(span).color;
		document.body.removeChild(host);
		if (!resolved || resolved === 'rgba(0, 0, 0, 0)' || resolved === 'transparent') {
			return toHex6(fallbackHex, fallbackHex);
		}
		return toHex6(resolved, fallbackHex);
	}

	function semantic(
		mainVar: string,
		contentVar: string,
		fallbackMain: string,
		fallbackContent: string
	) {
		const main = resolveThemeColor(mainVar, fallbackMain);
		const contrastText = resolveThemeColor(contentVar, fallbackContent);
		return { main, light: main, dark: main, contrastText };
	}

	/** Thème effectif (data-theme ou préférence système si absent / « system »). */
	function isDarkTheme(): boolean {
		const t = document.documentElement.getAttribute('data-theme');
		if (t === 'dark') return true;
		if (t === 'light') return false;
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	function buildRedocTheme(): Record<string, unknown> {
		const dark = isDarkTheme();
		/**
		 * Si le navigateur renvoie une couleur non parsable par toHex6, on retombe sur ces
		 * valeurs — elles doivent rester cohérentes clair/sombre (sinon texte illisible).
		 */
		const fb = dark
			? {
					base100: '#1d232a',
					base200: '#242933',
					base300: '#323945',
					baseContent: '#e2e8f0',
					neutral: '#2a3039',
					neutralContent: '#e2e8f0',
					warningContent: '#1c1917',
					errorContent: '#1c1917'
				}
			: {
					base100: '#ffffff',
					base200: '#f4f4f5',
					base300: '#e4e4e7',
					baseContent: '#18181b',
					neutral: '#3f3f46',
					neutralContent: '#fafafa',
					warningContent: '#1f2937',
					errorContent: '#1f2937'
				};

		const primary = semantic('--color-primary', '--color-primary-content', '#570df8', '#ffffff');
		const success = semantic('--color-success', '--color-success-content', '#36d399', '#ffffff');
		const warning = semantic(
			'--color-warning',
			'--color-warning-content',
			'#fbbd23',
			fb.warningContent
		);
		const error = semantic('--color-error', '--color-error-content', '#f87272', fb.errorContent);
		const info = resolveThemeColor('--color-info', '#3abff8');
		const base100 = resolveThemeColor('--color-base-100', fb.base100);
		const base200 = resolveThemeColor('--color-base-200', fb.base200);
		const base300 = resolveThemeColor('--color-base-300', fb.base300);
		const baseContent = resolveThemeColor('--color-base-content', fb.baseContent);
		const neutral = resolveThemeColor('--color-neutral', fb.neutral);
		const secondary = resolveThemeColor('--color-secondary', '#6366f1');
		const accent = resolveThemeColor('--color-accent', '#f471b6');

		const textSecondary = dark ? '#a3a3a3' : '#525252';

		/**
		 * Panneau droit « Response samples » : en thème sombre, fond Material (#263238) pour les
		 * tokens Prism prévus pour fond sombre. En thème clair, on aligne sur base-200 / base-300
		 * (variables daisy déjà résolues en hex pour Redoc).
		 */
		const samplePanelBg = dark ? '#263238' : base200;
		const samplePanelFg = dark ? '#eeffff' : baseContent;
		const sampleCodeBg = dark ? '#1b2327' : base300;

		/**
		 * Panneau droit : `.tab-success` etc. écrasent `rightPanel.textColor`. En sombre on garde la
		 * teinte sémantique sur fond #263238 ; en clair, `base200` + accents restent lisibles.
		 */
		const responseColors = (accentColor: string) => ({
			color: accentColor,
			backgroundColor: base200,
			tabTextColor: accentColor
		});

		return {
			spacing: { unit: 4, sectionHorizontal: 32, sectionVertical: 32 },
			breakpoints: { small: '50rem', medium: '85rem', large: '105rem' },
			colors: {
				tonalOffset: 0.12,
				primary,
				success,
				warning,
				error,
				/** Fond du panneau central / listes (voir theme.d.ts de redoc). */
				gray: { 50: base100, 100: base200 },
				border: { light: base300, dark: base300 },
				text: { primary: baseContent, secondary: textSecondary },
				responses: {
					success: responseColors(success.main),
					error: responseColors(error.main),
					redirect: responseColors(warning.main),
					info: responseColors(info)
				},
				http: {
					get: success.main,
					post: primary.main,
					put: warning.main,
					options: info,
					patch: secondary,
					delete: error.main,
					basic: neutral,
					link: info,
					head: accent
				}
			},
			sidebar: {
				width: '260px',
				backgroundColor: base200,
				textColor: baseContent,
				activeTextColor: primary.main,
				activeBackgroundColor: base300,
				groupItems: {
					activeBackgroundColor: base300,
					activeTextColor: primary.main,
					textTransform: 'uppercase'
				},
				level1Items: {
					activeBackgroundColor: base300,
					activeTextColor: primary.main,
					textTransform: 'none'
				},
				arrow: { size: '1.5em', color: baseContent }
			},
			rightPanel: {
				backgroundColor: samplePanelBg,
				textColor: samplePanelFg,
				width: '40%',
				servers: {
					overlay: { backgroundColor: base100, textColor: baseContent },
					url: { backgroundColor: base200 }
				}
			},
			schema: {
				nestedBackground: base200,
				typeNameColor: info,
				typeTitleColor: baseContent,
				requireLabelColor: error.main,
				linesColor: base300
			},
			codeBlock: { backgroundColor: sampleCodeBg },
			logo: { maxHeight: '260px', maxWidth: '260px', gutter: '2px' },
			typography: {
				fontFamily: `ui-sans-serif, system-ui, sans-serif, "Segoe UI", Roboto, sans-serif`,
				headings: {
					fontFamily: `ui-sans-serif, system-ui, sans-serif`,
					fontWeight: '600',
					lineHeight: '1.35em'
				},
				code: {
					fontSize: '13px',
					fontFamily: `ui-monospace, Menlo, Consolas, monospace`,
					lineHeight: '1.5em',
					fontWeight: '400',
					color: error.main,
					backgroundColor: base200,
					wrap: true
				},
				links: {
					color: primary.main,
					visited: primary.main,
					hover: primary.main,
					textDecoration: 'underline',
					hoverTextDecoration: 'underline'
				}
			},
			fab: { backgroundColor: samplePanelBg, color: samplePanelFg }
		};
	}

	onMount(() => {
		const node = container;
		if (!node) return;

		const win = window as typeof window & {
			Redoc?: { init: (url: string, opts: Record<string, unknown>, el: HTMLElement) => void };
		};

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		const mount = () => {
			if (!win.Redoc) return;
			node.innerHTML = '';
			node.setAttribute('data-redoc-palette', isDarkTheme() ? 'dark' : 'light');
			try {
				win.Redoc.init(SPEC_URL, { ...baseRedocOptions(), theme: buildRedocTheme() }, node);
			} catch (e) {
				console.error('Redoc (thème) :', e);
				try {
					node.innerHTML = '';
					win.Redoc.init(SPEC_URL, baseRedocOptions(), node);
				} catch (e2) {
					console.error('Redoc :', e2);
					node.innerHTML = `<p class="p-6 text-error">Erreur d’affichage. Spécification : <a class="link link-primary" href="${SPEC_URL}">openapi-public.yaml</a></p>`;
				}
			}
		};

		const onThemeChange = () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				mount();
			}, 50);
		};

		const observer = new MutationObserver(onThemeChange);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});

		const runAfterScript = () => mount();

		const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARK}]`);
		if (existing) {
			if (win.Redoc) runAfterScript();
			else existing.addEventListener('load', runAfterScript, { once: true });
		} else {
			const script = document.createElement('script');
			script.src = redocStandaloneUrl;
			script.async = true;
			script.setAttribute(SCRIPT_MARK, '');
			script.onload = () => runAfterScript();
			script.onerror = () => {
				node.innerHTML = `<p class="p-6 text-error">Impossible de charger Redoc. Spécification : <a class="link link-primary" href="${SPEC_URL}">openapi-public.yaml</a></p>`;
			};
			document.head.appendChild(script);
		}

		return () => {
			observer.disconnect();
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<svelte:head>
	<title>Documentation API publique</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div bind:this={container} class="redoc-host min-h-screen bg-base-100"></div>

<style>
	/*
	 * Redoc : la racine styled de `.redoc-markdown` ($f) n’impose pas `color` ; les <p> héritent
	 * d’ancêtres peu contrastés. On aligne le markdown de la colonne centrale sur daisyUI.
	 */
	:global(.redoc-wrap .api-content .redoc-markdown) {
		color: var(--color-base-content);
	}

	/*
	 * Titres de bloc d’opération (ex. « Query parameters ») : Redoc force rgba(38,50,56,.5), peu
	 * lisible sur base-100 / thèmes daisy. Tableaux de paramètres : préfixes de type en ~10 %
	 * d’opacité (styled ym) → spans quasi vides visuellement.
	 */
	:global(.redoc-wrap .api-content h5) {
		color: var(--color-base-content);
		border-bottom-color: color-mix(in srgb, var(--color-base-content) 30%, transparent);
		opacity: 1;
	}

	:global(.redoc-wrap .api-content table td span) {
		color: var(--color-base-content);
	}

	/*
	 * Palette claire : Prism + Redoc JSON utilisent des couleurs pour fond sombre (#a0fbaa,
	 * .token.property.string → white, collapser #fff). On recolle tout au thème daisy.
	 */
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap pre) {
		color: var(--color-base-content);
		background-color: var(--color-base-300);
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .redoc-json) {
		color: var(--color-base-content);
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .redoc-json code) {
		color: var(--color-base-content);
	}

	/* Boutons +/- d’expansion du JSON (Redoc force color: #fff) */
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .redoc-json .collapser) {
		color: var(--color-base-content) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .redoc-json .collapser:focus) {
		outline-color: var(--color-primary) !important;
	}

	/* Clés d’objet JSON : span.property.token.string — Redoc/Prism → white sur fond sombre */
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.property.string) {
		color: var(--color-info) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.property),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.tag),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.number),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.constant),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.symbol) {
		color: var(--color-info) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.boolean) {
		color: var(--color-error) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.keyword) {
		color: var(--color-secondary) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.selector),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.attr-name),
	/* Valeurs string uniquement : les clés sont `.property.token.string` (couleur info ci-dessus). */
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.string:not(.property)),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.char),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.builtin),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.inserted) {
		color: color-mix(in srgb, var(--color-success) 78%, var(--color-base-content) 22%) !important;
		opacity: 1 !important;
	}

	:global(
		.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.string:not(.property) + a,
		.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.string:not(.property) + a:visited
	) {
		color: var(--color-primary) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.operator),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.entity),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.url),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.variable) {
		color: var(--color-warning) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.comment),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.prolog),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.doctype),
	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.cdata) {
		color: color-mix(in srgb, var(--color-neutral) 55%, var(--color-base-content) 45%) !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .token.punctuation) {
		color: color-mix(in srgb, var(--color-base-content) 58%, transparent) !important;
		opacity: 1 !important;
	}

	:global(.redoc-host[data-redoc-palette='light'] .redoc-wrap .namespace) {
		color: var(--color-base-content) !important;
		opacity: 1 !important;
	}
</style>
