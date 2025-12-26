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
				'flex shrink-0 flex-col items-center justify-center gap-2 rounded-sm border border-border bg-muted p-4',
				className
			)}
		>
			{children}
		</div>
	);
};
