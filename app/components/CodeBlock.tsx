import { Code } from '@radix-ui/themes';

interface CodeBlockProps {
	children: string;
}

export function CodeBlock({ children }: CodeBlockProps) {
	return (
		<pre className="rounded-3 border border-gray-4 bg-surface p-3">
			<Code
				size="2"
				variant="ghost"
				style={{
					whiteSpace: 'pre-wrap',
				}}
				color="gray"
			>
				{children}
			</Code>
		</pre>
	);
}
