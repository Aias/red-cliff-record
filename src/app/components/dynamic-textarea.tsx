import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type Ref,
  type RefCallback,
} from 'react';
import { Textarea, type TextareaProps } from './field';

interface DynamicTextareaProps extends Omit<TextareaProps, 'rows'> {
  minRows?: number;
}

const DynamicTextarea = ({
  defaultValue,
  minRows = 1,
  onInput,
  ref,
  value,
  ...props
}: DynamicTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const combinedRef = useCombinedRefs(ref ?? null, textareaRef);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto so that scrollHeight is accurate
    textarea.style.height = 'auto';

    // Determine line height (fallback to 20px if undetermined)
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;

    // Compute minimum height based on minRows
    const minHeight = minRows * lineHeight;

    // Set height to the greater of scrollHeight or the minimum height
    const newHeight = Math.max(textarea.scrollHeight, minHeight);
    textarea.style.height = `${newHeight}px`;
  }, [minRows]);

  // Adjust immediately after DOM updates
  useLayoutEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  // If using a controlled component (value prop), adjust when it changes
  useEffect(() => {
    if (value !== undefined) {
      adjustHeight();
    }
  }, [adjustHeight, value]);

  // For uncontrolled components, watch for changes in defaultValue and update the value manually.
  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      if (textareaRef.current) {
        textareaRef.current.value = toTextareaValue(defaultValue);
        adjustHeight();
      }
    }
  }, [adjustHeight, defaultValue, value]);

  // Use a ResizeObserver to adjust the height if layout or font loading affects the content.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustHeight();
    });
    resizeObserver.observe(textarea);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustHeight]);

  const handleInput: NonNullable<ComponentPropsWithRef<'textarea'>['onInput']> = (event) => {
    adjustHeight();
    onInput?.(event);
  };

  return (
    <Textarea
      ref={combinedRef}
      resize="auto"
      {...props}
      defaultValue={defaultValue}
      onInput={handleInput}
      value={value}
    />
  );
};

DynamicTextarea.displayName = 'DynamicTextarea';

// Helper to combine multiple refs into one callback ref
function useCombinedRefs<T>(...refs: Array<Ref<T> | null>): RefCallback<T> {
  return useCallback(
    (element: T | null) => {
      refs.forEach((ref) => {
        if (!ref) return;
        if (typeof ref === 'function') {
          ref(element);
        } else {
          ref.current = element;
        }
      });
    },
    [refs]
  );
}

function toTextareaValue(value: string | number | readonly string[]) {
  return Array.isArray(value) ? value.join('\n') : String(value);
}

export { DynamicTextarea };
