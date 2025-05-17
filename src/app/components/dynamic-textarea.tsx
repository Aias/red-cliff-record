import * as React from 'react';
import { Textarea } from './ui/textarea';
import { cn } from '@/lib/utils';

interface DynamicTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'rows'> {
	minRows?: number;
}

const DynamicTextarea = React.forwardRef<HTMLTextAreaElement, DynamicTextareaProps>(
	({ className, minRows = 1, style, ...props }, ref) => {
		const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
		const combinedRef = useCombinedRefs(ref, textareaRef);

		const adjustHeight = React.useCallback(() => {
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
		React.useLayoutEffect(() => {
			adjustHeight();
		}, [adjustHeight]);

		// If using a controlled component (value prop), adjust when it changes
		React.useEffect(() => {
			if ('value' in props) {
				adjustHeight();
			}
		}, [props.value, adjustHeight]);

		// For uncontrolled components, watch for changes in defaultValue and update the value manually.
                React.useEffect(() => {
                        if (!('value' in props) && props.defaultValue !== undefined) {
                                if (textareaRef.current) {
                                        textareaRef.current.value = props.defaultValue as string;
                                        adjustHeight();
                                }
                        }
                }, [props.defaultValue, adjustHeight]);

		// Use a ResizeObserver to adjust the height if layout or font loading affects the content.
		React.useEffect(() => {
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

		return (
			<Textarea
				ref={combinedRef}
				className={cn('!min-h-0 resize-none overflow-hidden py-2', className)}
				style={style}
				onInput={adjustHeight}
				{...props}
			/>
		);
	}
);

DynamicTextarea.displayName = 'DynamicTextarea';

// Helper to combine multiple refs into one callback ref
function useCombinedRefs<T>(
	...refs: Array<React.ForwardedRef<T> | React.RefObject<T> | null>
): React.RefCallback<T> {
	return React.useCallback(
		(element: T | null) => {
			refs.forEach((ref) => {
				if (!ref) return;
				if (typeof ref === 'function') {
					ref(element);
				} else {
					(ref as React.MutableRefObject<T | null>).current = element;
				}
			});
		},
		[refs]
	);
}

export { DynamicTextarea };
