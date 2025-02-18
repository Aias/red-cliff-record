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
			<div className="flex w-full flex-col gap-2 bg-rcr-background p-4">
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-tint"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-stain"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-dye"></div>
			</div>
			<div className="flex w-full flex-col gap-2 bg-rcr-surface p-4">
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-tint"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-stain"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-dye"></div>
			</div>
			<div className="flex w-full flex-col gap-2 bg-transparent p-4">
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-tint"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-stain"></div>
				<div className="h-8 w-full rounded border border-rcr-divider bg-rcr-dye"></div>
			</div>
			{children}
		</div>
	);
};
