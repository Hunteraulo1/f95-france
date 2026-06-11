<script lang="ts">
	import type { Inline, ListItem, MarkdownBlock } from '$lib/markdown/content';
	import '$lib/styles/legal-markdown.css';

	interface Props {
		document: MarkdownBlock[];
		/** Classe CSS du conteneur (styles typographiques du markdown). */
		class?: string;
	}

	let { document, class: className = 'legal-markdown' }: Props = $props();
</script>

{#snippet inlines(nodes: Inline[])}
	{#each nodes as node, i (i)}
		{#if node.kind === 'text'}
			{node.text}
		{:else if node.kind === 'strong'}
			<strong>{@render inlines(node.children)}</strong>
		{:else if node.kind === 'em'}
			<em>{@render inlines(node.children)}</em>
		{:else if node.kind === 'link'}
			<a class="link link-hover" href={node.href} rel="noopener noreferrer" target="_blank">
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
		<ol class="list-decimal">
			{#each items as item, i (i)}
				<li class="my-1">
					{@render renderBlocks(item.blocks)}
				</li>
			{/each}
		</ol>
	{:else}
		<ul class="list-disc">
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
				<h1>{@render inlines(block.inlines)}</h1>
			{:else if block.level === 2}
				<h2>{@render inlines(block.inlines)}</h2>
			{:else if block.level === 3}
				<h3>{@render inlines(block.inlines)}</h3>
			{:else if block.level === 4}
				<h4>{@render inlines(block.inlines)}</h4>
			{:else if block.level === 5}
				<h5>{@render inlines(block.inlines)}</h5>
			{:else}
				<h6>{@render inlines(block.inlines)}</h6>
			{/if}
		{:else if block.kind === 'paragraph'}
			<p>{@render inlines(block.inlines)}</p>
		{:else if block.kind === 'list'}
			{@render listItems(block.items, block.ordered)}
		{:else if block.kind === 'hr'}
			<hr class="my-8 border-base-300" />
		{:else if block.kind === 'blockquote'}
			<blockquote class="border-l-4 border-primary pl-4">
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
