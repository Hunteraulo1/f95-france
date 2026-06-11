<script lang="ts">
	import HomeHeroMockupShell from '$lib/components/home/HomeHeroMockupShell.svelte';

	type SheetLine = {
		widthClass: string;
		delayClass: string;
	};

	const shuffleSheetLines = (items: readonly SheetLine[], random: () => number): SheetLine[] => {
		const result = [...items];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	};

	const sheetLineClass =
		'relative h-[0.62rem] overflow-hidden rounded-sm bg-base-content/16 before:absolute before:inset-y-0 before:left-0 before:w-[35%] before:bg-primary/28 before:opacity-50 before:animate-drift before:content-[""]';

	const sheetLineVariants: SheetLine[] = [
		{ widthClass: 'w-[82%]', delayClass: 'before:[animation-delay:-0.2s]' },
		{ widthClass: 'w-[64%]', delayClass: 'before:[animation-delay:-1s]' },
		{ widthClass: 'w-[74%]', delayClass: 'before:[animation-delay:-1.8s]' },
		{ widthClass: 'w-[52%]', delayClass: 'before:[animation-delay:-2.6s]' }
	];

	const sheetRowSignature = (row: SheetLine[]) => row.map((line) => line.widthClass).join('|');

	const buildRandomSheetRows = (random: () => number): SheetLine[][] => {
		const rows: SheetLine[][] = [];
		for (let i = 0; i < 6; i++) {
			let row = shuffleSheetLines(sheetLineVariants, random);
			let attempts = 0;
			while (i > 0 && sheetRowSignature(row) === sheetRowSignature(rows[i - 1]) && attempts < 24) {
				row = shuffleSheetLines(sheetLineVariants, random);
				attempts++;
			}
			rows.push(row);
		}
		return rows;
	};

	const createSeededRandom = (seed: number) => {
		let state = seed;
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296;
			return state / 4294967296;
		};
	};

	const sheetRows = buildRandomSheetRows(createSeededRandom(77));

	const sheetGridClass =
		'grid box-border grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.75fr)] gap-2';
</script>

<HomeHeroMockupShell badge="Liste des traductions">
	<div class="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
		<div
			class="{sheetGridClass} shrink-0 rounded-lg bg-primary/16 p-2 text-xs font-semibold text-base-content sm:text-sm"
		>
			<div class="line-clamp-1">NOM DU JEU</div>
			<div class="line-clamp-1">VERSION</div>
			<div class="line-clamp-1">TRAD. VER.</div>
			<div class="line-clamp-1">STATUS</div>
		</div>
		{#each sheetRows as row, rowIndex (rowIndex)}
			<div
				class="{sheetGridClass} rounded-lg border border-base-content/12 p-2.5 hover:bg-base-200/80"
			>
				{#each row as line, lineIndex (lineIndex)}
					<div class="{sheetLineClass} {line.widthClass} {line.delayClass}"></div>
				{/each}
			</div>
		{/each}
	</div>
</HomeHeroMockupShell>
