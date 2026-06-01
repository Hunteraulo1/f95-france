<script lang="ts">
	import type {
		SubmissionModalItem,
		SubmissionModalTranslator,
		SubmissionPrimitive
	} from '$lib/components/dashboard/submissions/submission-modal-types';
	import {
		formatFieldValue,
		GAME_FIELDS,
		getFieldValue,
		normalizeTranslatorPages,
		TRANSLATION_FIELDS,
		valuesAreEqual
	} from '$lib/components/dashboard/submissions/submission-modal-field-utils';

	interface Props {
		submission: SubmissionModalItem;
		translators: SubmissionModalTranslator[];
		onTranslatorClick: (translatorId: unknown) => void | Promise<void>;
	}

	let { submission, translators, onTranslatorClick }: Props = $props();

	const getTranslator = (translatorId: unknown): SubmissionModalTranslator | null => {
		if (typeof translatorId !== 'string' || !translatorId) return null;
		return translators.find((t) => t.id === translatorId) || null;
	};

	const formatValue = (value: SubmissionPrimitive, showIfEmpty: boolean, key?: string): string =>
		formatFieldValue(value, showIfEmpty, key, translators);
</script>

<div class="md flex-1 overflow-y-auto pr-2 md:border-r md:border-base-300 md:pr-0">
	{#if submission.type === 'delete'}
		<div class="space-y-4">
			<div role="alert" class="alert alert-error">
				<span>Cette soumission demande une suppression définitive après acceptation.</span>
			</div>
			{#if submission.translationId && (submission.currentTranslation || submission.parsedData?.translation)}
				<div class="rounded-box border border-base-300 p-4">
					<h4 class="text-md mb-2 font-semibold">Traduction concernée</h4>
					<p class="text-sm">
						{submission.currentTranslation?.translationName ??
							submission.parsedData?.translation?.translationName ??
							'—'}
						{#if submission.currentTranslation?.tversion ?? submission.parsedData?.translation?.tversion}
							<span class="opacity-70">
								(v{submission.currentTranslation?.tversion ??
									submission.parsedData?.translation?.tversion})
							</span>
						{/if}
					</p>
				</div>
			{:else if submission.currentGame || submission.parsedData?.game}
				<div class="rounded-box border border-base-300 p-4">
					<h4 class="text-md mb-2 font-semibold">Jeu concerné</h4>
					<p class="text-sm font-medium">
						{submission.currentGame?.name ?? submission.parsedData?.game?.name ?? '—'}
					</p>
				</div>
			{/if}
			{#if submission.parsedData?.reason}
				<div class="rounded-box border border-base-300 p-4">
					<h4 class="text-md mb-2 font-semibold">Raison de la suppression</h4>
					<p class="text-sm whitespace-pre-wrap">{submission.parsedData.reason}</p>
				</div>
			{/if}
		</div>
	{:else if submission.type === 'translator_pages'}
		{@const proposedPages = normalizeTranslatorPages(submission.parsedData?.pages)}
		{@const currentPages = submission.currentTranslator?.pages ?? []}
		{@const fallbackOldPages = normalizeTranslatorPages(submission.parsedData?.originalPages)}
		{@const oldPages =
			currentPages.length > 0
				? currentPages
				: submission.status === 'accepted'
					? fallbackOldPages
					: []}
		{@const maxRows = Math.max(oldPages.length, proposedPages.length, 1)}
		<div class="space-y-4">
			<div class="alert alert-info">
				<div class="space-y-1">
					<div class="font-semibold">Validation des pages traducteur</div>
					<div class="text-sm opacity-80">
						Traducteur: <strong>{submission.currentTranslator?.name ?? 'Inconnu'}</strong>
					</div>
				</div>
			</div>
			<div class="overflow-x-auto rounded-box border border-base-300">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>#</th>
							<th class="w-[45%]">Pages actuelles</th>
							<th class="w-[45%]">Pages proposées</th>
						</tr>
					</thead>
					<tbody>
						{#each Array.from({ length: maxRows }, (_unused, i) => i) as index (index)}
							{@const oldEntry = oldPages[index] ?? { name: '', link: '' }}
							{@const newEntry = proposedPages[index] ?? { name: '', link: '' }}
							{@const isChanged =
								oldEntry.name !== newEntry.name || oldEntry.link !== newEntry.link}
							<tr class={isChanged ? 'bg-warning/10' : ''}>
								<td class="font-mono text-xs opacity-70">{index + 1}</td>
								<td>
									<div class="space-y-1">
										<div class="font-medium">{oldEntry.name || '(vide)'}</div>
										<div class="text-xs break-all opacity-70">
											{oldEntry.link || '(vide)'}
										</div>
									</div>
								</td>
								<td>
									<div class="space-y-1">
										<div class="font-medium text-success">{newEntry.name || '(vide)'}</div>
										<div class="text-xs break-all text-success/80">
											{newEntry.link || '(vide)'}
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if submission.type === 'update' && submission.parsedData?.game && submission.currentGame}
		{@const hasAnyChanges = GAME_FIELDS.some((field) => {
			if (!submission?.currentGame || !submission?.parsedData?.game) {
				return false;
			}
			const oldValue = getFieldValue(submission.currentGame, field.key);
			const newValue = getFieldValue(submission.parsedData.game, field.key);
			return !valuesAreEqual(oldValue, newValue, String(field.key));
		})}
		{#if hasAnyChanges}
			<div class="space-y-4">
				{#each GAME_FIELDS as field (field.key)}
					{@const oldValue = getFieldValue(submission.currentGame, field.key)}
					{@const newValue = getFieldValue(submission.parsedData.game, field.key)}
					{@const fieldKey = String(field.key)}
					{#if !valuesAreEqual(oldValue, newValue, String(field.key))}
						{@const formattedOld = formatValue(
							oldValue,
							field.options?.showIfEmpty ?? false,
							String(field.key)
						)}
						{@const formattedNew = formatValue(
							newValue,
							field.options?.showIfEmpty ?? false,
							String(field.key)
						)}
						{@const classes = `${
							field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
						} ${field.options?.isUrl ? 'break-all' : ''} ${
							field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
						}`.trim()}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">{field.label}:</div>
							<div class="space-y-1">
								{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && oldValue}
									{@const oldTranslator = getTranslator(oldValue)}
									{#if oldTranslator?.userId}
										<button
											type="button"
											class="link link-error {classes} line-through"
											onclick={() => onTranslatorClick(oldValue)}
										>
											{formattedOld}
										</button>
									{:else}
										<div class="{classes} text-error line-through">{formattedOld}</div>
									{/if}
								{:else}
									<div class="{classes} text-error line-through">{formattedOld}</div>
								{/if}
								{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && newValue}
									{@const newTranslator = getTranslator(newValue)}
									{#if newTranslator?.userId}
										<button
											type="button"
											class="link link-success {classes} {field.options?.isMultiline ||
											field.options?.isUrl
												? ''
												: 'font-medium'}"
											onclick={() => onTranslatorClick(newValue)}
										>
											{formattedNew}
										</button>
									{:else}
										<div
											class="{classes} {field.options?.isMultiline || field.options?.isUrl
												? ''
												: 'font-medium'} text-success"
										>
											{formattedNew}
										</div>
									{/if}
								{:else}
									<div
										class="{classes} {field.options?.isMultiline || field.options?.isUrl
											? ''
											: 'font-medium'} text-success"
									>
										{formattedNew}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="alert alert-info">
				<span>Aucun changement détecté entre le jeu actuel et les modifications proposées.</span>
			</div>
		{/if}
	{:else if submission.type === 'game' && (submission.currentGame || submission.parsedData?.game)}
		{#if submission.currentGame || submission.parsedData?.game}
			{@const gameData =
				submission.status === 'accepted'
					? submission.parsedData?.game
					: submission.currentGame || submission.parsedData?.game}
			<div class="space-y-4">
				<h4 class="text-md mb-2 font-semibold">Détails du jeu</h4>
				{#each GAME_FIELDS as field (field.key)}
					{@const value = getFieldValue(gameData!, field.key)}
					{@const formattedValue = formatValue(
						value,
						field.options?.showIfEmpty ?? false,
						String(field.key)
					)}
					{@const fieldKey = String(field.key)}
					{#if formattedValue !== '' || field.options?.showIfEmpty}
						{@const classes = `${
							field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
						} ${field.options?.isUrl ? 'break-all' : ''} ${
							field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
						}`.trim()}
						<div class="border-b border-base-300 pb-3">
							<div class="mb-2 font-semibold">{field.label}:</div>
							{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && value}
								{@const translator = getTranslator(value)}
								{#if translator?.userId}
									<button
										type="button"
										class="link link-primary {classes}"
										onclick={() => onTranslatorClick(value)}
									>
										{formattedValue}
									</button>
								{:else}
									<div class={classes}>{formattedValue}</div>
								{/if}
							{:else}
								<div class={classes}>{formattedValue}</div>
							{/if}
						</div>
					{/if}
				{/each}
				{#if submission.currentTranslation || submission.parsedData?.translation}
					{@const translationData =
						submission.status === 'accepted'
							? submission.parsedData?.translation
							: submission.currentTranslation || submission.parsedData?.translation}
					<div class="mt-6">
						<h4 class="text-md mb-2 font-semibold">Détails de la traduction</h4>
						{#each TRANSLATION_FIELDS as field (field.key)}
							{@const value = getFieldValue(translationData!, field.key)}
							{@const formattedValue = formatValue(
								value,
								field.options?.showIfEmpty ?? false,
								String(field.key)
							)}
							{#if formattedValue !== '' || field.options?.showIfEmpty}
								{@const classes = `${
									field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
								} ${field.options?.isUrl ? 'break-all' : ''} ${
									field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
								}`.trim()}
								<div class="border-b border-base-300 pb-3">
									<div class="mb-2 font-semibold">{field.label}:</div>
									<div class={classes}>{formattedValue}</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{:else if submission.type === 'translation' && (submission.currentTranslation || submission.parsedData?.translation)}
		{#if submission.currentTranslation || submission.parsedData?.translation}
			{@const translationData =
				submission.status === 'accepted'
					? submission.parsedData?.translation
					: submission.currentTranslation || submission.parsedData?.translation}
			{#if submission.currentTranslation && submission.parsedData?.translation && submission.status !== 'accepted'}
				{@const hasAnyChanges = TRANSLATION_FIELDS.some((field) => {
					if (!submission?.currentTranslation || !submission?.parsedData?.translation) {
						return false;
					}
					const oldValue = getFieldValue(submission.currentTranslation, field.key);
					const newValue = getFieldValue(submission.parsedData.translation, field.key);
					return !valuesAreEqual(oldValue, newValue, String(field.key));
				})}
				{#if hasAnyChanges}
					<div class="space-y-4">
						{#each TRANSLATION_FIELDS as field (field.key)}
							{@const oldValue = getFieldValue(submission.currentTranslation, field.key)}
							{@const newValue = getFieldValue(submission.parsedData.translation, field.key)}
							{@const fieldKey = String(field.key)}
							{#if !valuesAreEqual(oldValue, newValue, String(field.key))}
								{@const formattedOld = formatValue(
									oldValue,
									field.options?.showIfEmpty ?? false,
									String(field.key)
								)}
								{@const formattedNew = formatValue(
									newValue,
									field.options?.showIfEmpty ?? false,
									String(field.key)
								)}
								{@const classes = `${
									field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
								} ${field.options?.isUrl ? 'break-all' : ''} ${
									field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
								}`.trim()}
								<div class="border-b border-base-300 pb-3">
									<div class="mb-2 font-semibold">{field.label}:</div>
									<div class="space-y-1">
										{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && oldValue}
											{@const oldTranslator = getTranslator(oldValue)}
											{#if oldTranslator?.userId}
												<button
													type="button"
													class="link link-error {classes} line-through"
													onclick={() => onTranslatorClick(oldValue)}
												>
													{formattedOld}
												</button>
											{:else}
												<div class="{classes} text-error line-through">{formattedOld}</div>
											{/if}
										{:else}
											<div class="{classes} text-error line-through">{formattedOld}</div>
										{/if}
										{#if (fieldKey === 'translatorId' || fieldKey === 'proofreaderId') && newValue}
											{@const newTranslator = getTranslator(newValue)}
											{#if newTranslator?.userId}
												<button
													type="button"
													class="link link-success {classes} {field.options?.isMultiline ||
													field.options?.isUrl
														? ''
														: 'font-medium'}"
													onclick={() => onTranslatorClick(newValue)}
												>
													{formattedNew}
												</button>
											{:else}
												<div
													class="{classes} {field.options?.isMultiline || field.options?.isUrl
														? ''
														: 'font-medium'} text-success"
												>
													{formattedNew}
												</div>
											{/if}
										{:else}
											<div
												class="{classes} {field.options?.isMultiline || field.options?.isUrl
													? ''
													: 'font-medium'} text-success"
											>
												{formattedNew}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="alert alert-info">
						<span
							>Aucun changement détecté entre la traduction actuelle et les modifications proposées.</span
						>
					</div>
				{/if}
			{:else}
				<div class="space-y-4">
					{#each TRANSLATION_FIELDS as field (field.key)}
						{@const value = getFieldValue(translationData!, field.key)}
						{@const formattedValue = formatValue(
							value,
							field.options?.showIfEmpty ?? false,
							String(field.key)
						)}
						{#if formattedValue !== '' || field.options?.showIfEmpty}
							{@const classes = `${
								field.options?.isMultiline || field.options?.isUrl ? 'text-sm' : ''
							} ${field.options?.isUrl ? 'break-all' : ''} ${
								field.options?.isMultiline ? 'whitespace-pre-wrap' : ''
							}`.trim()}
							<div class="border-b border-base-300 pr-1 pb-3 last:border-b-0 last:pb-0">
								<div class="mb-2 font-semibold">{field.label}:</div>
								<div class={classes}>{formattedValue}</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
