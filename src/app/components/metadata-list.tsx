import { useState } from 'react';
import { CopyIcon } from '@phosphor-icons/react';
import { z } from 'zod';
import { Button } from './button';
import {
	DataListItem,
	DataListLabel,
	DataListRoot,
	DataListValue,
	type DataListRootProps,
} from './data-list';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from './dialog';
import { ExternalLink } from './external-link';
import { ScrollArea } from './scroll-area';

interface MetadataListProps extends DataListRootProps {
	metadata: Record<string, unknown>;
}

const urlSchema = z.url();

export const MetadataList = ({ metadata, ...props }: MetadataListProps) => {
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const copyToClipboard = (value: unknown) => {
		const stringValue = value instanceof Object ? JSON.stringify(value, null, 2) : String(value);
		void navigator.clipboard.writeText(stringValue);
	};

	const handleCopy = (key: string, value: unknown) => {
		copyToClipboard(value);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	const formatValue = (value: unknown) => {
		if (value === null || value === undefined) return null;
		if (value instanceof Date) return value.toLocaleString();
		if (value instanceof Object) {
			return (
				<pre className="block text-[0.875em] break-all whitespace-pre-wrap text-muted-foreground">
					{JSON.stringify(value, null, 2)}
				</pre>
			);
		}
		if (value instanceof Array) return value.join(', ');

		const stringValue = String(value);
		const urlResult = urlSchema.safeParse(stringValue);
		if (urlResult.success) {
			return <ExternalLink href={urlResult.data}>{stringValue}</ExternalLink>;
		}
		return stringValue;
	};

	return (
		<DataListRoot {...props}>
			{Object.entries(metadata).map(([key, value]) => (
				<DataListItem key={key}>
					<DataListLabel>{key}</DataListLabel>
					<DataListValue className="group relative">
						{value === null || value === undefined ? (
							<span className="text-muted-foreground">—</span>
						) : (
							<div className="flex items-baseline gap-2">
								<div className="flex-1" onClick={() => handleCopy(key, value)}>
									{formatValue(value)}
								</div>
								{copiedKey === key ? (
									<div className="absolute top-0 right-0 text-xs text-muted-foreground">
										Copied!
									</div>
								) : (
									<CopyIcon className="absolute right-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								)}
							</div>
						)}
					</DataListValue>
				</DataListItem>
			))}
		</DataListRoot>
	);
};

interface MetadataDialogButtonProps {
	metadata: Record<string, unknown>;
	buttonText?: string;
	buttonProps?: Omit<React.ComponentProps<typeof Button>, 'onClick'>;
	description?: string;
}

export const MetadataDialogButton: React.FC<MetadataDialogButtonProps> = ({
	metadata,
	buttonText = 'Metadata',
	buttonProps,
	description = 'Metadata inspector',
}) => {
	return (
		<Dialog>
			<DialogTrigger render={<Button {...buttonProps} />}>{buttonText}</DialogTrigger>
			<DialogContent className="flex max-h-[90vh] max-w-[75vw] flex-col overflow-hidden px-0 py-5">
				<DialogHeader className="mb-3 border-b border-border px-5 pb-3">
					<DialogTitle className="mb-0.5">Metadata</DialogTitle>
					<DialogDescription className="text-muted-foreground">{description}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="px-5">
					<MetadataList metadata={metadata} />
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};
