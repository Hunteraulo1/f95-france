import type { EditorView } from '@codemirror/view';

export type BioMarkdownAction =
	'bold' | 'italic' | 'link' | 'heading' | 'ul' | 'ol' | 'quote' | 'code' | 'hr';

type TextEditResult = {
	value: string;
	selectionStart: number;
	selectionEnd: number;
	changeFrom: number;
	changeTo: number;
	insert: string;
};

function wrapSelection(
	value: string,
	start: number,
	end: number,
	prefix: string,
	suffix: string,
	placeholder: string
): TextEditResult {
	const selected = value.slice(start, end);
	const inner = selected || placeholder;
	const insert = prefix + inner + suffix;
	const nextValue = value.slice(0, start) + insert + value.slice(end);

	if (selected) {
		const cursor = start + insert.length;
		return {
			value: nextValue,
			selectionStart: cursor,
			selectionEnd: cursor,
			changeFrom: start,
			changeTo: end,
			insert
		};
	}

	const selectStart = start + prefix.length;
	const selectEnd = selectStart + placeholder.length;
	return {
		value: nextValue,
		selectionStart: selectStart,
		selectionEnd: selectEnd,
		changeFrom: start,
		changeTo: end,
		insert
	};
}

function insertLink(value: string, start: number, end: number): TextEditResult {
	const label = value.slice(start, end) || 'texte';
	const insert = `[${label}](https://)`;
	const nextValue = value.slice(0, start) + insert + value.slice(end);
	const urlStart = start + label.length + 3;
	const urlEnd = urlStart + 'https://'.length;
	return {
		value: nextValue,
		selectionStart: urlStart,
		selectionEnd: urlEnd,
		changeFrom: start,
		changeTo: end,
		insert
	};
}

function prefixLines(
	value: string,
	start: number,
	end: number,
	prefix: string,
	skipIf: RegExp
): TextEditResult {
	const lineStart = value.lastIndexOf('\n', start - 1) + 1;
	const lineEndIndex = value.indexOf('\n', end);
	const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
	const block = value.slice(lineStart, lineEnd);
	const lines = block.split('\n');

	let offset = 0;
	const prefixed = lines.map((line) => {
		if (skipIf.test(line)) return line;
		offset += prefix.length;
		return prefix + line;
	});

	const insert = prefixed.join('\n');
	const nextValue = value.slice(0, lineStart) + insert + value.slice(lineEnd);
	const cursor = end + offset;
	return {
		value: nextValue,
		selectionStart: cursor,
		selectionEnd: cursor,
		changeFrom: lineStart,
		changeTo: lineEnd,
		insert
	};
}

function prefixOrderedLines(value: string, start: number, end: number): TextEditResult {
	const lineStart = value.lastIndexOf('\n', start - 1) + 1;
	const lineEndIndex = value.indexOf('\n', end);
	const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
	const block = value.slice(lineStart, lineEnd);
	const lines = block.split('\n');

	let index = 1;
	let offset = 0;
	const prefixed = lines.map((line) => {
		if (/^\s*\d+\.\s/.test(line)) return line;
		const prefix = `${index}. `;
		index += 1;
		offset += prefix.length;
		return prefix + line;
	});

	const insert = prefixed.join('\n');
	const nextValue = value.slice(0, lineStart) + insert + value.slice(lineEnd);
	const cursor = end + offset;
	return {
		value: nextValue,
		selectionStart: cursor,
		selectionEnd: cursor,
		changeFrom: lineStart,
		changeTo: lineEnd,
		insert
	};
}

function applyTextEdit(
	value: string,
	start: number,
	end: number,
	action: BioMarkdownAction
): TextEditResult {
	switch (action) {
		case 'bold':
			return wrapSelection(value, start, end, '**', '**', 'gras');
		case 'italic':
			return wrapSelection(value, start, end, '*', '*', 'italique');
		case 'code':
			return wrapSelection(value, start, end, '`', '`', 'code');
		case 'link':
			return insertLink(value, start, end);
		case 'heading':
			return prefixLines(value, start, end, '## ', /^#{1,6}\s/);
		case 'ul':
			return prefixLines(value, start, end, '- ', /^\s*[-*]\s/);
		case 'ol':
			return prefixOrderedLines(value, start, end);
		case 'quote':
			return prefixLines(value, start, end, '> ', /^\s*>\s/);
		case 'hr': {
			const insert = start > 0 && value[start - 1] !== '\n' ? '\n\n---\n' : '---\n';
			const nextValue = value.slice(0, start) + insert + value.slice(end);
			const cursor = start + insert.length;
			return {
				value: nextValue,
				selectionStart: cursor,
				selectionEnd: cursor,
				changeFrom: start,
				changeTo: end,
				insert
			};
		}
	}
}

function applyToEditorView(view: EditorView, action: BioMarkdownAction): void {
	const { from, to } = view.state.selection.main;
	const current = view.state.doc.toString();
	const result = applyTextEdit(current, from, to, action);

	view.dispatch({
		changes: { from: result.changeFrom, to: result.changeTo, insert: result.insert },
		selection: { anchor: result.selectionStart, head: result.selectionEnd }
	});
	view.focus();
}

function applyToTextarea(textarea: HTMLTextAreaElement, action: BioMarkdownAction): TextEditResult {
	return applyTextEdit(textarea.value, textarea.selectionStart, textarea.selectionEnd, action);
}

export function applyBioMarkdownAction(
	action: BioMarkdownAction,
	options: {
		view?: EditorView | null;
		textarea?: HTMLTextAreaElement | null;
	}
): TextEditResult | null {
	if (options.view) {
		applyToEditorView(options.view, action);
		return null;
	}

	if (options.textarea) {
		return applyToTextarea(options.textarea, action);
	}

	return null;
}

export const BIO_MARKDOWN_TOOLBAR: Array<{
	action: BioMarkdownAction;
	label: string;
	shortcut?: string;
}> = [
	{ action: 'bold', label: 'Gras', shortcut: 'Ctrl+B' },
	{ action: 'italic', label: 'Italique', shortcut: 'Ctrl+I' },
	{ action: 'link', label: 'Lien' },
	{ action: 'heading', label: 'Titre' },
	{ action: 'ul', label: 'Liste à puces' },
	{ action: 'ol', label: 'Liste numérotée' },
	{ action: 'quote', label: 'Citation' },
	{ action: 'code', label: 'Code inline' },
	{ action: 'hr', label: 'Séparateur' }
];
