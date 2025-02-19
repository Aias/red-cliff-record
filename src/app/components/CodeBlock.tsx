import { cn } from '@/app/lib/utils';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
	children: string;
	language?: string;
}

export function CodeBlock({ children, className, language, ...props }: CodeBlockProps) {
	return (
		<pre
			className={cn(
				'rounded-sm border border-rcr-divider bg-rcr-surface p-3 text-sm whitespace-pre-wrap text-rcr-secondary',
				className
			)}
			{...props}
		>
			<code data-language={language}>{children}</code>
		</pre>
	);
}
