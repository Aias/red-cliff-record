import { cn } from '@/lib/utils';

export const Placeholder = ({
	children,
	className = '',
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<div
			className={cn(
				'flex h-full shrink-0 grow flex-col items-center justify-center gap-2 rounded-sm border border-rcr-divider bg-rcr-tint p-4',
				className
			)}
		>
			{children}
		</div>
	);
};
