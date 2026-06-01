import { marked, type Token, type Tokens } from 'marked';

export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'strong'; children: Inline[] }
	| { kind: 'em'; children: Inline[] }
	| { kind: 'link'; href: string; children: Inline[] }
	| { kind: 'code'; text: string }
	| { kind: 'br' };

export type ListItem = { blocks: MarkdownBlock[] };

export type MarkdownBlock =
	| { kind: 'heading'; level: number; inlines: Inline[] }
	| { kind: 'paragraph'; inlines: Inline[] }
	| { kind: 'list'; ordered: boolean; items: ListItem[] }
	| { kind: 'hr' }
	| { kind: 'blockquote'; blocks: MarkdownBlock[] }
	| { kind: 'table'; headers: Inline[][]; rows: Inline[][][] };

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeHref(href: string): string | null {
	try {
		const url = new URL(href);
		if (!SAFE_LINK_PROTOCOLS.has(url.protocol)) return null;
		return href;
	} catch {
		return null;
	}
}

function parseInlines(tokens: Token[] | undefined): Inline[] {
	if (!tokens?.length) return [];

	const inlines: Inline[] = [];

	for (const token of tokens) {
		switch (token.type) {
			case 'text':
				if (token.tokens?.length) {
					inlines.push(...parseInlines(token.tokens));
				} else {
					inlines.push({ kind: 'text', text: token.text });
				}
				break;
			case 'strong':
				inlines.push({ kind: 'strong', children: parseInlines(token.tokens) });
				break;
			case 'em':
				inlines.push({ kind: 'em', children: parseInlines(token.tokens) });
				break;
			case 'link': {
				const href = safeHref(token.href);
				const children = parseInlines(token.tokens);
				if (href) {
					inlines.push({ kind: 'link', href, children });
				} else if (children.length) {
					inlines.push(...children);
				} else {
					inlines.push({ kind: 'text', text: token.text });
				}
				break;
			}
			case 'codespan':
				inlines.push({ kind: 'code', text: token.text });
				break;
			case 'br':
				inlines.push({ kind: 'br' });
				break;
			case 'escape':
				inlines.push({ kind: 'text', text: token.text });
				break;
			default:
				if ('text' in token && typeof token.text === 'string') {
					inlines.push({ kind: 'text', text: token.text });
				}
		}
	}

	return inlines;
}

function parseListItem(item: Tokens.ListItem): ListItem {
	const nested = item.tokens?.filter((t) => t.type !== 'text') ?? [];
	if (nested.length > 0) {
		return { blocks: parseBlocks(nested) };
	}
	return {
		blocks: [{ kind: 'paragraph', inlines: parseInlines(item.tokens) }]
	};
}

function parseTable(token: Tokens.Table): MarkdownBlock {
	const headers = token.header.map((cell) => parseInlines(cell.tokens));
	const rows = token.rows.map((row) => row.map((cell) => parseInlines(cell.tokens)));
	return { kind: 'table', headers, rows };
}

function parseBlocks(tokens: Token[]): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];

	for (const token of tokens) {
		switch (token.type) {
			case 'space':
				break;
			case 'heading':
				blocks.push({
					kind: 'heading',
					level: token.depth,
					inlines: parseInlines(token.tokens)
				});
				break;
			case 'paragraph':
				blocks.push({ kind: 'paragraph', inlines: parseInlines(token.tokens) });
				break;
			case 'list':
				blocks.push({
					kind: 'list',
					ordered: token.ordered,
					items: token.items.map(parseListItem)
				});
				break;
			case 'hr':
				blocks.push({ kind: 'hr' });
				break;
			case 'blockquote':
				blocks.push({ kind: 'blockquote', blocks: parseBlocks(token.tokens ?? []) });
				break;
			case 'table':
				blocks.push(parseTable(token as Tokens.Table));
				break;
			default:
				break;
		}
	}

	return blocks;
}

/** Convertit du markdown en arbre sûr pour le rendu Svelte (sans `{@html}`). */
export function parseMarkdownDocument(markdown: string): MarkdownBlock[] {
	return parseBlocks(marked.lexer(markdown));
}
