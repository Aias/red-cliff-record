import { DataList, Text } from '@radix-ui/themes';

export const MetadataList = ({ metadata }: { metadata: Record<string, unknown> }) => {
	return (
		<DataList.Root className="border-y border-gray-a4 py-4">
			{Object.entries(metadata).map(([key, value]) => (
				<DataList.Item key={key}>
					<DataList.Label>{key}</DataList.Label>
					<DataList.Value>
						{value ? (
							value instanceof Date ? (
								value.toLocaleString()
							) : value instanceof Object ? (
								JSON.stringify(value)
							) : value instanceof Array ? (
								value.join(', ')
							) : (
								String(value)
							)
						) : (
							<Text color="gray">—</Text>
						)}
					</DataList.Value>
				</DataList.Item>
			))}
		</DataList.Root>
	);
};
