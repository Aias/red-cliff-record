import React, { type ReactNode } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '~/lib/utils';

export type AvatarProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
	src?: string | undefined;
	fallback?: ReactNode;
	rounded?: boolean;
	themed?: boolean;
	inline?: boolean;
};

const Avatar = React.forwardRef<React.ComponentRef<typeof AvatarPrimitive.Root>, AvatarProps>(
	({ className, rounded = false, src, fallback, themed = true, inline = false, ...props }, ref) => (
		<AvatarPrimitive.Root
			ref={ref}
			className={cn(
				'relative flex size-[2.25em] shrink-0 overflow-hidden',
				rounded ? 'rounded-full' : 'rounded-sm',
				themed && 'themed',
				inline && 'size-[1.2lh] [&_.avatar-fallback]:text-[1em]',
				className
			)}
			{...props}
		>
			<AvatarImage src={src} />
			<AvatarFallback>{fallback}</AvatarFallback>
		</AvatarPrimitive.Root>
	)
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
	React.ComponentRef<typeof AvatarPrimitive.Image>,
	React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
	<AvatarPrimitive.Image
		ref={ref}
		className={cn('aspect-square h-full w-full rounded-[inherit] object-cover', className)}
		{...props}
	/>
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
	React.ComponentRef<typeof AvatarPrimitive.Fallback>,
	React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
	<AvatarPrimitive.Fallback
		ref={ref}
		className={cn(
			'flex h-full w-full items-center justify-center rounded-[inherit] border border-tint bg-stain text-[1.15em] font-medium',
			'avatar-fallback',
			className
		)}
		{...props}
	/>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
