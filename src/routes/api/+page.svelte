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
			return (
				'#' +
				[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
			).toLowerCase();
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

		const primary = semantic(
			'--color-primary',
			'--color-primary-content',
			'#570df8',
			'#ffffff'
		);
		const success = semantic(
			'--color-success',
			'--color-success-content',
			'#36d399',
			'#ffffff'
		);
		const warning = semantic(
			'--color-warning',
			'--color-warning-content',
			'#fbbd23',
			fb.warningContent
		);
		const error = semantic(
			'--color-error',
			'--color-error-content',
			'#f87272',
			fb.errorContent
		);
		const info = resolveThemeColor('--color-info', '#3abff8');
		const base100 = resolveThemeColor('--color-base-100', fb.base100);
		const base200 = resolveThemeColor('--color-base-200', fb.base200);
		const base300 = resolveThemeColor('--color-base-300', fb.base300);
		const baseContent = resolveThemeColor('--color-base-content', fb.baseContent);
		const neutral = resolveThemeColor('--color-neutral', fb.neutral);
		const neutralContent = resolveThemeColor('--color-neutral-content', fb.neutralContent);
		const secondary = resolveThemeColor('--color-secondary', '#6366f1');
		const accent = resolveThemeColor('--color-accent', '#f471b6');

		const textSecondary = dark ? '#a3a3a3' : '#525252';

		/**
		 * Panneau droit « Response samples » : les tokens Prism de Redoc sont pensés pour un fond
		 * sombre type Material (#263238). Avec neutral/neutralContent daisy, le contraste casse
		 * (ponctuation en opacité sur couleur héritée, etc.).
		 */
		const samplePanelBg = '#263238';
		const samplePanelFg = '#eeffff';
		const sampleCodeBg = '#1b2327';

		/**
		 * Panneau droit (variante Wp) : `.tab-success` etc. s’appliquent après l’onglet sélectionné
		 * et écrasent `rightPanel.textColor`. `baseContent` sur fond #263238 est illisible — on garde
		 * la teinte sémantique (contraste suffisant sur fond sombre).
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
			try {
				win.Redoc.init(
					SPEC_URL,
					{ ...baseRedocOptions(), theme: buildRedocTheme() },
					node
				);
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

<div bind:this={container} class="min-h-screen bg-base-100"></div>

<style>
	/*
	 * Redoc : la racine styled de `.redoc-markdown` ($f) n’impose pas `color` ; les <p> héritent
	 * d’ancêtres peu contrastés. On aligne le markdown de la colonne centrale sur daisyUI.
	 * (.api-content exclut le panneau droit « Response samples », fond sombre + texte clair.)
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
</style>
