import { Link } from '@tanstack/react-router';
import { Avatar } from '@/components/avatar'; // Adjusted path to import Avatar from components
import { parseToSingleLine } from '@/lib/marked';

interface SearchResultProps {
	id: number;
	title: string;
	content?: string | null;
	type: 'record' | 'index'; // Assuming 'index' might be a future type
	url?: string | null;
	imageUrl?: string | null;
	subType?: string | null;
	onClick?: () => void; // Keep onClick if needed for combobox item selection
}

export function SearchResult({
	title,
	content,
	type,
	imageUrl,
	subType,
	id,
	onClick,
}: SearchResultProps) {
	return (
		<div className="flex w-full gap-3 py-2 text-sm" onClick={onClick}>
			<Avatar src={imageUrl ?? undefined} fallback={title[0]?.toUpperCase() ?? '?'} />
			<div className="flex flex-1 flex-col gap-1">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Link
							to="/records/$recordId"
							params={{ recordId: id.toString() }}
							className="font-medium"
							// Prevent link navigation if onClick is provided (handled by combobox)
							onClick={(e) => {
								if (onClick) {
									e.preventDefault();
									// onClick(); // This will be handled by CommandItem
								}
							}}
						>
							{title}
						</Link>
						{subType && <span className="text-c-secondary">{subType}</span>}
					</div>
					<span className="text-c-secondary capitalize">{type}</span>
				</div>
				{content && (
					<span
						className="line-clamp-2 text-c-secondary"
						dangerouslySetInnerHTML={{
							__html: parseToSingleLine(content),
						}}
					/>
				)}
			</div>
		</div>
	);
}
