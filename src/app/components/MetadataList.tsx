import { DataList, Text } from '@radix-ui/themes';

interface MetadataListProps extends DataList.RootProps {
	metadata: Record<string, unknown>;
}

export const MetadataList = ({ metadata, className = '', ...props }: MetadataListProps) => {
	return (
		<DataList.Root className={`gap-2 ${className}`} {...props}>
			{Object.entries(metadata).map(([key, value]) => (
				<DataList.Item key={key}>
					<DataList.Label>{key}</DataList.Label>
					<DataList.Value>
						{value ? (
							value instanceof Date ? (
								value.toLocaleString()
							) : value instanceof Object ? (
								<pre className="block break-all whitespace-pre-wrap">
									<Text as="span" color="gray" size="1">
										{JSON.stringify(value, null, 2)}
									</Text>
								</pre>
							) : value instanceof Array ? (
								value.join(', ')
							) : (
								String(value)
							)
						) : (
							<Text color="gray" className="text-hint">
								—
							</Text>
						)}
					</DataList.Value>
				</DataList.Item>
			))}
		</DataList.Root>
	);
};
