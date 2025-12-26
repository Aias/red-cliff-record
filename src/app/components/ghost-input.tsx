import * as React from 'react';
import { cn } from '@/lib/utils';

export interface GhostInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	initialValue?: string;
	onValueChange?: (value: string) => void;
}

function GhostInput({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			data-slot="input"
			type={type}
			className={cn(
				'm-0 w-full border-none bg-transparent p-0 text-inherit outline-none',
				'transition-colors',
				'placeholder:text-muted-foreground disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

GhostInput.displayName = 'GhostInput';

export { GhostInput };
