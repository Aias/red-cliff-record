import { useEffect, useLayoutEffect, useRef } from 'react';
import { Textarea, type TextareaProps } from './textarea';

export interface DynamicTextareaProps extends Omit<TextareaProps, 'rows'> {
  minRows?: number;
  maxRows?: number;
}

function adjustHeight(textarea: HTMLTextAreaElement, minRows: number, maxRows?: number) {
  // Collapse first so scrollHeight reflects content, then clamp between the minRows floor and maxRows cap.
  textarea.style.height = 'auto';
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
  const contentHeight = textarea.scrollHeight;
  const maxHeight = maxRows ? maxRows * lineHeight : Infinity;
  textarea.style.height = `${Math.min(Math.max(contentHeight, minRows * lineHeight), maxHeight)}px`;
  // Scroll once content outgrows the cap; otherwise the textarea owns its full height.
  textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
}

const DynamicTextarea = ({
  minRows = 1,
  maxRows,
  onInput,
  ref,
  value,
  ...props
}: DynamicTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Re-measure on mount and whenever the controlled value or row bounds change.
  useLayoutEffect(() => {
    if (textareaRef.current) adjustHeight(textareaRef.current, minRows, maxRows);
  }, [value, minRows, maxRows]);

  // Re-measure when font loading or layout reflows the textarea without a React render.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const observer = new ResizeObserver(() => adjustHeight(textarea, minRows, maxRows));
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [minRows, maxRows]);

  const setRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const handleInput: DynamicTextareaProps['onInput'] = (event) => {
    if (textareaRef.current) adjustHeight(textareaRef.current, minRows, maxRows);
    onInput?.(event);
  };

  return <Textarea ref={setRef} resize="auto" {...props} value={value} onInput={handleInput} />;
};

export { DynamicTextarea };
