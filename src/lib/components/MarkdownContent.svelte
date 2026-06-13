<script lang="ts">
	import type { Inline, ListItem, MarkdownBlock } from '$lib/markdown/content';

	interface Props {
		document: MarkdownBlock[];
		variant?: 'legal' | 'profile';
		class?: string;
	}

	let { document, variant = 'legal', class: className = '' }: Props = $props();

	const p = variant === 'profile';

	const h1Class = p
		? 'mt-0 mb-1.5 text-lg font-semibold leading-snug text-base-content'
		: 'mt-0 mb-2 text-2xl font-bold leading-tight text-base-content';
	const h2Class = p
		? 'mt-4 mb-1.5 text-[1.0625rem] font-semibold leading-snug text-base-content'
		: 'mt-6 mb-2 text-xl font-bold leading-tight text-base-content';
	const h3Class = p
		? 'mt-4 mb-1.5 text-base font-semibold leading-snug text-base-content'
		: 'mt-6 mb-2 text-lg font-bold leading-tight text-base-content';
	const h4Class = p
		? 'mt-4 mb-1.5 text-base font-semibold leading-snug text-base-content'
		: 'mt-6 mb-2 text-base font-bold leading-tight text-base-content';
	const pClass = p ? 'mb-3 leading-[1.6] text-base-content/90' : 'mb-4 leading-[1.65] text-base-content/85';
	const ulClass = p ? 'mb-3 list-disc pl-5' : 'mb-4 list-disc pl-6';
	const olClass = p ? 'mb-3 list-decimal pl-5' : 'mb-4 list-decimal pl-6';
	const hrClass = p ? 'my-4 border-base-300' : 'my-8 border-base-300';
	const blockquoteClass = p
		? 'my-3 border-l-[3px] border-primary pl-3 text-base-content/80'
		: 'my-4 border-l-[3px] border-primary pl-4 text-base-content/75';
</script>

{#snippet inlines(nodes: Inline[])}
	{#each nodes as node, i (i)}
		{#if node.kind === 'text'}
			{node.text}
		{:else if node.kind === 'strong'}
			<strong class="font-semibold text-base-content">{@render inlines(node.children)}</strong>
		{:else if node.kind === 'em'}
			<em>{@render inlines(node.children)}</em>
		{:else if node.kind === 'link'}
			<a class="text-primary underline underline-offset-2 hover:opacity-85" href={node.href} rel="noopener noreferrer" target="_blank">
				{@render inlines(node.children)}
			</a>
		{:else if node.kind === 'code'}
			<code class="rounded bg-base-200 px-1 py-0.5 text-sm">{node.text}</code>
		{:else if node.kind === 'br'}
			<br />
		{/if}
	{/each}
{/snippet}

{#snippet listItems(items: ListItem[], ordered: boolean)}
	{#if ordered}
		<ol class={olClass}>
			{#each items as item, i (i)}
				<li class="my-1">
					{@render renderBlocks(item.blocks)}
				</li>
			{/each}
		</ol>
	{:else}
		<ul class={ulClass}>
			{#each items as item, i (i)}
				<li class="my-1">
					{@render renderBlocks(item.blocks)}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet renderBlocks(nodes: MarkdownBlock[])}
	{#each nodes as block, i (i)}
		{#if block.kind === 'heading'}
			{#if block.level === 1}
				<h1 class={h1Class}>{@render inlines(block.inlines)}</h1>
			{:else if block.level === 2}
				<h2 class={h2Class}>{@render inlines(block.inlines)}</h2>
			{:else if block.level === 3}
				<h3 class={h3Class}>{@render inlines(block.inlines)}</h3>
			{:else if block.level === 4}
				<h4 class={h4Class}>{@render inlines(block.inlines)}</h4>
			{:else if block.level === 5}
				<h5 class={h4Class}>{@render inlines(block.inlines)}</h5>
			{:else}
				<h6 class={h4Class}>{@render inlines(block.inlines)}</h6>
			{/if}
		{:else if block.kind === 'paragraph'}
			<p class={pClass}>{@render inlines(block.inlines)}</p>
		{:else if block.kind === 'list'}
			{@render listItems(block.items, block.ordered)}
		{:else if block.kind === 'hr'}
			<hr class={hrClass} />
		{:else if block.kind === 'blockquote'}
			<blockquote class={blockquoteClass}>
				{@render renderBlocks(block.blocks)}
			</blockquote>
		{:else if block.kind === 'table'}
			<div class="overflow-x-auto">
				<table class="table table-zebra table-sm">
					<thead>
						<tr>
							{#each block.headers as header, j (j)}
								<th>{@render inlines(header)}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each block.rows as row, j (j)}
							<tr>
								{#each row as cell, k (k)}
									<td>{@render inlines(cell)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/each}
{/snippet}

<div class={className}>
	{@render renderBlocks(document)}
</div>
