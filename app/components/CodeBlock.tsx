// components/CodeBlock.tsx
import { Box, Code } from '@radix-ui/themes';

interface CodeBlockProps {
	children: string;
}

export function CodeBlock({ children }: CodeBlockProps) {
	return (
		<Box className="bg-surface border border-gray-4 rounded-3 p-3">
			<pre>
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
		</Box>
	);
}
