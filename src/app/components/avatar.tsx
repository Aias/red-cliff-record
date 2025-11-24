import React, { type ReactNode } from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export type AvatarProps = React.ComponentPropsWithRef<typeof AvatarPrimitive.Root> & {
	src?: string | undefined;
	fallback?: ReactNode;
	rounded?: boolean;
	themed?: boolean;
};

const Avatar = ({
	className,
	rounded = false,
	src,
	fallback,
	themed = true,
	...props
}: AvatarProps) => (
	<AvatarPrimitive.Root
		className={cn(
			'relative flex size-[1.4em] shrink-0 overflow-hidden [&_.avatar-fallback]:text-[1em]',
			rounded ? 'rounded-full' : 'rounded-sm',
			themed && 'themed',
			className
		)}
		tabIndex={-1}
		{...props}
	>
		<AvatarImage src={src} />
		{fallback && <AvatarFallback>{fallback}</AvatarFallback>}
	</AvatarPrimitive.Root>
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

type AvatarImageProps = React.ComponentPropsWithRef<typeof AvatarPrimitive.Image>;

const AvatarImage = ({ className, ...props }: AvatarImageProps) => (
	<AvatarPrimitive.Image
		className={cn('aspect-square h-full w-full rounded-[inherit] object-cover', className)}
		{...props}
	/>
);
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

type AvatarFallbackProps = React.ComponentPropsWithRef<typeof AvatarPrimitive.Fallback>;

const AvatarFallback = ({ className, ...props }: AvatarFallbackProps) => (
	<AvatarPrimitive.Fallback
		className={cn(
			'flex h-full w-full items-center justify-center rounded-[inherit] border border-c-mist bg-c-splash text-[1.15em] font-medium',
			'avatar-fallback',
			className
		)}
		{...props}
	/>
);
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
