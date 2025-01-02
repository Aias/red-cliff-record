// components/CodeBlock.tsx
import { Box, Code } from '@radix-ui/themes';

interface CodeBlockProps {
	children: string;
}

export function CodeBlock({ children }: CodeBlockProps) {
	return (
		<Box
			style={{
				backgroundColor: 'var(--color-surface)',
				borderRadius: 'var(--radius-3)',
				border: '1px solid var(--gray-4)',
			}}
			p="3"
		>
			<pre style={{ margin: 0 }}>
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
