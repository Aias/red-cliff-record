import { Heading, ScrollArea } from '@radix-ui/themes';
import { MetadataList } from '~/app/components/MetadataList';

interface QueueItemInspectorProps<T extends Record<string, unknown>> {
	item: T;
	lookup: (item: T) => string;
}

export const QueueItemInspector = <T extends Record<string, unknown>>({
	item,
	lookup,
}: QueueItemInspectorProps<T>) => {
	return (
		<div className="flex grow gap-3">
			<div className="flex max-w-sm flex-col gap-3">
				<Heading size="3" as="h2">
					{lookup(item)}
				</Heading>
				<ScrollArea scrollbars="vertical">
					<MetadataList metadata={item} className="gap-3" />
				</ScrollArea>
			</div>
		</div>
	);
};
