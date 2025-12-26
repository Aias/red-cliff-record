import { cn } from '@/lib/utils';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
	children: string;
	language?: string;
}

export function CodeBlock({ children, className, language, ...props }: CodeBlockProps) {
	return (
		<pre
			className={cn(
				'rounded-sm border border-border bg-background p-3 text-sm whitespace-pre-wrap text-muted-foreground',
				className
			)}
			{...props}
		>
			<code data-language={language}>{children}</code>
		</pre>
	);
}
