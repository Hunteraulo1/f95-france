<script lang="ts">
	import { browser } from '$app/environment';
	import {
		applyBioMarkdownAction,
		BIO_MARKDOWN_TOOLBAR,
		type BioMarkdownAction
	} from '$lib/markdown/bio-toolbar';
	import { PROFILE_BIO_MAX_LENGTH } from '$lib/profile/custom-profile';
	import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
	import { EditorState } from '@codemirror/state';
	import type { EditorView } from '@codemirror/view';
	import Bold from '@lucide/svelte/icons/bold';
	import Code from '@lucide/svelte/icons/code';
	import Heading2 from '@lucide/svelte/icons/heading-2';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Minus from '@lucide/svelte/icons/minus';
	import Quote from '@lucide/svelte/icons/quote';
	import { onMount, tick } from 'svelte';
	import type CodeMirrorComponent from 'svelte-codemirror-editor';

	interface Props {
		value?: string;
		name?: string;
		maxLength?: number;
		placeholder?: string;
	}

	let {
		value = $bindable(''),
		name = 'profileBio',
		maxLength = PROFILE_BIO_MAX_LENGTH,
		placeholder = 'Présentez-vous, vos spécialités, vos projets…'
	}: Props = $props();

	let Editor = $state<typeof CodeMirrorComponent | null>(null);
	let editorView = $state<EditorView | null>(null);
	let fallbackTextarea = $state<HTMLTextAreaElement | null>(null);

	const markdownLang = markdown({ base: markdownLanguage, codeLanguages: [] });
	const extensions = $derived.by(() => [
		EditorState.transactionFilter.of((transaction) => {
			if (!transaction.docChanged) return transaction;
			return transaction.newDoc.length <= maxLength ? transaction : [];
		})
	]);

	const toolbarIcons: Record<BioMarkdownAction, typeof Bold> = {
		bold: Bold,
		italic: Italic,
		link: Link,
		heading: Heading2,
		ul: List,
		ol: ListOrdered,
		quote: Quote,
		code: Code,
		hr: Minus
	};

	onMount(async () => {
		if (!browser) return;
		const module = await import('svelte-codemirror-editor');
		Editor = module.default;
	});

	async function handleToolbarAction(action: BioMarkdownAction) {
		const result = applyBioMarkdownAction(action, {
			view: editorView,
			textarea: editorView ? null : fallbackTextarea
		});

		if (result) {
			value = result.value;
			await tick();
			fallbackTextarea?.setSelectionRange(result.selectionStart, result.selectionEnd);
			fallbackTextarea?.focus();
		}
	}

	function handleEditorReady(view: EditorView) {
		editorView = view;
	}
</script>

<div
	class="editor-shell w-full overflow-hidden rounded border border-base-300 bg-base-100 text-base-content transition-[border-color,outline] duration-150"
>
	<div
		class="profile-bio-toolbar flex flex-wrap gap-1 border-b border-base-300 bg-base-200/50 p-1"
		role="toolbar"
		aria-label="Mise en forme markdown"
	>
		{#each BIO_MARKDOWN_TOOLBAR as item (item.action)}
			{@const Icon = toolbarIcons[item.action]}
			<button
				type="button"
				class="btn btn-ghost btn-xs gap-1 px-2"
				title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
				aria-label={item.label}
				onclick={() => handleToolbarAction(item.action)}
			>
				<Icon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				<span class="hidden sm:inline">{item.label}</span>
			</button>
		{/each}
	</div>

	<div class="w-full overflow-hidden bg-base-100">
		{#if Editor}
			<Editor
				bind:value
				lang={markdownLang}
				{extensions}
				{placeholder}
				lineNumbers={false}
				lineWrapping={true}
				foldGutter={false}
				autocompletion={false}
				onready={handleEditorReady}
				styles={{
					'&': { width: '100%', minHeight: '12rem', backgroundColor: 'transparent' },
					'&.cm-focused': { outline: 'none' },
					'.cm-scroller': {
						fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
						fontSize: '0.875rem',
						lineHeight: '1.5',
						overflow: 'auto'
					},
					'.cm-content': { padding: '0.75rem 1rem', caretColor: 'var(--color-base-content)' },
					'.cm-gutters': { display: 'none' },
					'.cm-placeholder': {
						color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)',
						fontStyle: 'normal'
					}
				}}
			/>
		{:else}
			<textarea
				bind:this={fallbackTextarea}
				class="min-h-48 w-full resize-none bg-transparent px-4 py-3 font-mono text-sm outline-none"
				rows="8"
				maxlength={maxLength}
				{placeholder}
				bind:value
				aria-label="Bio (markdown)"></textarea>
		{/if}
	</div>
</div>

{#if name}
	<input type="hidden" {name} {value} />
{/if}

<style>
	.editor-shell:focus-within {
		border-color: color-mix(in oklch, var(--color-base-content) 20%, var(--color-base-300));
		outline: 2px solid color-mix(in oklch, var(--color-base-content) 20%, transparent);
		outline-offset: 2px;
	}
</style>
