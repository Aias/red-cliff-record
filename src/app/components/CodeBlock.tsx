import { Code, type CodeProps } from '@radix-ui/themes';

interface CodeBlockProps extends CodeProps {
	children: string;
	language?: string;
}

export function CodeBlock({ children, language, ...props }: CodeBlockProps) {
	return (
		<pre className="rounded-3 border border-rcr-divider bg-rcr-surface p-3 whitespace-pre-wrap">
			<Code size="2" variant="ghost" color="gray" data-language={language} {...props}>
				{children}
			</Code>
		</pre>
	);
}
