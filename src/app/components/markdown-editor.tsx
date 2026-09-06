import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { Tag, tags } from '@lezer/highlight';
import { GFM } from '@lezer/markdown';
import type { DelimiterType, MarkdownConfig } from '@lezer/markdown';
import { useEffect, useRef } from 'react';
import { css } from '@/styled-system/css';

const highlightTag = Tag.define();
const highlightDelimiter: DelimiterType = { resolve: 'Highlight', mark: 'HighlightMark' };
const highlightMarkdown: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': highlightTag } },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(context, next, position) {
        if (next !== 61 || context.char(position + 1) !== 61 || context.char(position + 2) === 61) {
          return -1;
        }
        const before = context.slice(position - 1, position);
        const after = context.slice(position + 2, position + 3);
        return context.addDelimiter(
          highlightDelimiter,
          position,
          position + 2,
          after.length > 0 && !/\s/.test(after),
          before.length > 0 && !/\s/.test(before)
        );
      },
      after: 'Emphasis',
    },
  ],
};

const markdownHighlighting = HighlightStyle.define([
  { tag: tags.processingInstruction, class: css({ color: 'muted' }) },
  { tag: tags.strong, class: css({ fontWeight: 'medium' }) },
  { tag: [tags.emphasis, tags.quote], class: css({ fontStyle: 'italic' }) },
  { tag: [tags.link, tags.url], class: css({ color: 'accent', fontWeight: 'medium' }) },
  {
    tag: tags.monospace,
    class: css({ fontFamily: 'mono', backgroundColor: 'splash', borderRadius: 'md' }),
  },
  { tag: tags.strikethrough, class: css({ textDecoration: 'line-through' }) },
  { tag: tags.heading1, class: css({ textStyle: '2xl', fontWeight: 'semibold' }) },
  { tag: tags.heading2, class: css({ textStyle: 'xl', fontWeight: 'medium' }) },
  { tag: tags.heading3, class: css({ textStyle: 'lg', fontWeight: 'medium' }) },
  { tag: tags.heading4, class: css({ textStyle: 'base', fontWeight: 'medium' }) },
  {
    tag: [tags.heading5, tags.heading6],
    class: css({ textStyle: 'sm', fontWeight: 'semibold' }),
  },
  { tag: highlightTag, class: css({ backgroundColor: 'mist', color: 'accent' }) },
]);

const editorClass = css({
  width: 'full',
  '& .cm-editor': {
    width: 'full',
    borderRadius: 'sm',
    backgroundColor: 'transparent',
    color: 'primary',
    outline: 'none',
  },
  '&[data-readonly="false"] .cm-editor.cm-focused': {
    outlineColor: 'focus/50',
    outlineOffset: '0.5',
    outlineStyle: 'solid',
    outlineWidth: '2px',
  },
  '& .cm-scroller': {
    overflow: 'auto',
    fontFamily: 'sans',
  },
  '& .cm-content': {
    minHeight: '6',
    paddingInline: '0',
    paddingBlock: '0',
    textStyle: 'xs',
    caretColor: 'accent',
  },
  '& .cm-line': {
    paddingInline: '0',
  },
  '& .cm-content ::selection': {
    backgroundColor: 'splash',
  },
  _disabled: {
    '& .cm-editor': {
      opacity: '50%',
      pointerEvents: 'none',
    },
  },
});

const configuration = new Compartment();
const externalChange = Annotation.define<boolean>();

function accessibility(label: string, disabled: boolean, readOnly: boolean) {
  return EditorView.contentAttributes.of({
    'aria-disabled': disabled ? 'true' : 'false',
    'aria-label': label,
    'aria-multiline': 'true',
    'aria-readonly': readOnly ? 'true' : 'false',
    autocapitalize: 'sentences',
    spellcheck: readOnly ? 'false' : 'true',
  });
}

function editableConfiguration(label: string, disabled: boolean, readOnly: boolean) {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    accessibility(label, disabled, readOnly),
  ];
}

function changedRange(current: string, next: string) {
  let from = 0;
  while (from < current.length && from < next.length && current[from] === next[from]) from++;
  let currentTo = current.length;
  let nextTo = next.length;
  while (currentTo > from && nextTo > from && current[currentTo - 1] === next[nextTo - 1]) {
    currentTo--;
    nextTo--;
  }
  return { from, to: currentTo, insert: next.slice(from, nextTo) };
}

type MarkdownEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  label: string;
};

export function MarkdownEditor({ value, onChange, disabled = false, label }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const onChangeRef = useRef(onChange);
  const readOnly = disabled || !onChange;

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: '',
        extensions: [
          markdown({ extensions: [GFM, highlightMarkdown] }),
          syntaxHighlighting(markdownHighlighting),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          configuration.of(editableConfiguration('', true, true)),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) => transaction.annotation(externalChange))
            ) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: changedRange(current, value),
      annotations: [externalChange.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: configuration.reconfigure(editableConfiguration(label, disabled, readOnly)),
    });
  }, [disabled, label, readOnly]);

  return (
    <div
      ref={containerRef}
      className={editorClass}
      aria-disabled={disabled}
      data-readonly={readOnly}
    />
  );
}
