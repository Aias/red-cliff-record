import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/app/lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-c-focus focus-visible:ring-[3px] focus-visible:ring-c-focus/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-c-main data-[state=unchecked]:bg-c-border dark:data-[state=unchecked]:bg-c-border/80',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					'pointer-events-none block size-4 rounded-full bg-c-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-c-main-contrast dark:data-[state=unchecked]:bg-c-primary'
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
