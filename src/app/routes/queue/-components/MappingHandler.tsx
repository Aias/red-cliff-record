import { useEffect, useState } from 'react';
import { Button, Heading, ScrollArea, Text } from '@radix-ui/themes';
import type { QueueActions, QueueConfig, QueueItem } from './types';

interface MappingHandlerProps<TInput, TOutput>
	extends Pick<QueueActions<TInput, TOutput>, 'handleSearch' | 'handleCreate' | 'handleLink'> {
	config: QueueConfig<TInput, TOutput>;
	inspectedItem: TInput;
	inspectedQueueItem: QueueItem;
}

export const MappingHandler = <TInput, TOutput>({
	config,
	inspectedItem,
	inspectedQueueItem,
	handleSearch,
	handleCreate,
	handleLink,
}: MappingHandlerProps<TInput, TOutput>) => {
	const [matches, setMatches] = useState<TOutput[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	useEffect(() => {
		let mounted = true;

		const searchForMatches = async () => {
			try {
				setIsLoading(true);
				const results = await handleSearch(config.getInputTitle(inspectedItem));
				if (mounted) {
					setMatches(results);
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : 'Failed to search for matches');
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		searchForMatches();
		return () => {
			mounted = false;
		};
	}, [inspectedItem, config, handleSearch]);

	const handleCreateAndLink = async () => {
		try {
			const newEntry = await handleCreate(inspectedItem);
			if (newEntry) {
				await handleLink(inspectedQueueItem.id, config.getOutputId(newEntry));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create and link entry');
		}
	};

	if (isLoading && matches.length === 0) {
		return (
			<div className="flex items-center justify-center p-8">
				<Text size="2" color="gray">
					Searching for matches...
				</Text>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 p-8">
				<Text color="red">{error}</Text>
				<Button onClick={() => setError(undefined)}>Try Again</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<Heading size="3" as="h3">
				Potential Matches
			</Heading>
			{matches.length > 0 ? (
				<ScrollArea>
					<div className="flex flex-col gap-2">
						{matches.map((match) => (
							<section
								key={config.getOutputId(match)}
								className="flex items-center gap-2 rounded-md border border-divider p-2"
							>
								<div className="flex-1">
									<Text as="div" size="2" weight="medium">
										{config.getOutputTitle(match)}
									</Text>
								</div>
								<Button
									size="1"
									variant="soft"
									onClick={() =>
										handleLink(config.getInputId(inspectedItem), config.getOutputId(match))
									}
								>
									Link
								</Button>
							</section>
						))}
					</div>
				</ScrollArea>
			) : (
				<Text size="2" color="gray">
					No matches found
				</Text>
			)}

			<div className="mt-2 flex justify-center border-t border-divider pt-4">
				<Button size="2" variant="surface" className="w-full" onClick={handleCreateAndLink}>
					Create New Entry
				</Button>
			</div>
		</div>
	);
};
