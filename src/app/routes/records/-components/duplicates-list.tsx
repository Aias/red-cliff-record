import { Link, useNavigate } from '@tanstack/react-router';
import { MergeIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { recordTypeIcons } from './type-icons';
import {
	Avatar,
	Badge,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	ExternalLink,
	IntegrationLogo,
	Placeholder,
	Spinner,
} from '@/components';

interface DuplicatesListProps {
	recordId: number;
}

export const DuplicatesList = ({ recordId }: DuplicatesListProps) => {
	const navigate = useNavigate();
	const utils = trpc.useUtils();
	const { data: duplicates, isLoading } = trpc.records.findDuplicates.useQuery(recordId, {
		enabled: !!recordId,
	});

	const handleMerge = trpc.records.merge.useMutation({
		onSuccess: (data) => {
			console.log('Merge Success', data);
			const { updatedRecord } = data;
			navigate({
				to: '/records/$recordId',
				params: { recordId: updatedRecord.id.toString() },
			});
			utils.records.invalidate();
		},
	});

	const onMergeClick = (targetId: number) => {
		if (!recordId) return;

		handleMerge.mutate({
			sourceId: recordId,
			targetId: targetId,
		});
	};

	return duplicates && duplicates.length > 0 ? (
		<ol className="flex flex-col text-sm">
			{duplicates.map((record) => {
				const {
					id,
					title,
					abbreviation,
					format,
					sense,
					type,
					recordCreatedAt,
					url,
					sources,
					avatarUrl,
					content,
					summary,
					notes,
				} = record;

				const identifier = title || 'Untitled Record';
				const formattedDate = recordCreatedAt.toLocaleDateString();
				const description = content || summary || notes;
				const TypeIcon = recordTypeIcons[type].icon;

				return (
					<li
						key={id}
						className="flex flex-col gap-1 border-b border-border px-3 py-2 first:border-t"
					>
						<div className="flex items-center gap-2">
							<Avatar src={avatarUrl ?? undefined} fallback={identifier.charAt(0)} />
							<div className="flex grow items-center gap-2">
								<Link to="/records/$recordId" params={{ recordId: id.toString() }}>
									{identifier}
								</Link>
								{abbreviation && <span>({abbreviation})</span>}
								{sense && <em className="text-c-secondary">{sense}</em>}
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Badge className="before:mr-[0.15ch] before:text-c-hint before:content-['#']">
										<span>{id}</span>
										<ul className="ml-2 flex items-center gap-1.5 text-[0.875em]">
											{sources?.map((source) => (
												<li key={source}>
													<IntegrationLogo integration={source} />
												</li>
											))}
										</ul>
									</Badge>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem onClick={() => onMergeClick(id)}>
										<MergeIcon />
										Merge
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<p className="line-clamp-2 text-xs text-c-secondary">{description}</p>
						<div className="flex items-center justify-around gap-2 rounded-md border border-border bg-c-mist px-3 py-1 text-xs font-medium">
							{type && (
								<span className="flex items-center gap-1 capitalize">
									{<TypeIcon className="text-c-symbol" />}
									<span>{type}</span>
								</span>
							)}
							{format && <span>{format.title}</span>}
							{url && <ExternalLink href={url}>{new URL(url).hostname}</ExternalLink>}
							<span>{formattedDate}</span>
						</div>
					</li>
				);
			})}
		</ol>
	) : isLoading ? (
		<Placeholder>
			<Spinner />
			<p>Searching for duplicates...</p>
		</Placeholder>
	) : (
		<div className="py-2 text-muted-foreground">No potential duplicates found.</div>
	);
};
