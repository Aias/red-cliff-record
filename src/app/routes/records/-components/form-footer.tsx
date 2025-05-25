import { memo } from 'react';
import type { ReactFormApi } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { SaveIcon, Trash2Icon } from 'lucide-react';
import type { RecordGet } from '@/server/api/routers/types';
import { MetadataSection } from './metadata-section';
import { Avatar } from '@/components/avatar';
import { Spinner } from '@/components/spinner';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FormFooterProps {
	form: ReactFormApi<
		RecordGet,
		unknown,
		unknown,
		unknown,
		unknown,
		unknown,
		unknown,
		unknown,
		unknown,
		void
	>;
	record: RecordGet;
	onDelete: () => void;
}

export const FormFooter = memo(({ form, record, onDelete }: FormFooterProps) => {
	return (
		<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
			{([canSubmit, isSubmitting]) => (
				<div className="order-first -mt-1 mb-3 flex items-center border-b border-c-divider pb-1">
					<Popover>
						<PopoverTrigger asChild>
							<Avatar
								src={record.avatarUrl ?? undefined}
								fallback={(record.title?.charAt(0) ?? record.type.charAt(0)).toUpperCase()}
								className="mr-2 cursor-pointer"
							/>
						</PopoverTrigger>
						<PopoverContent className="min-w-84">
							<MetadataSection record={record} />
						</PopoverContent>
					</Popover>
					<Link
						to="/records/$recordId"
						params={{ recordId: record.id.toString() }}
						search={true}
						className="mr-auto truncate font-mono text-sm text-c-secondary capitalize"
					>
						{`${record.type} #${record.id}, ${record.recordCreatedAt.toLocaleString()}`}
					</Link>
					<Button size="icon" variant="ghost" type="submit" disabled={!canSubmit || isSubmitting}>
						{isSubmitting ? <Spinner /> : <SaveIcon />}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button size="icon" variant="ghost" type="button">
								<Trash2Icon />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete this record.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<Button variant="destructive" asChild>
									<AlertDialogAction onClick={onDelete}>Continue</AlertDialogAction>
								</Button>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			)}
		</form.Subscribe>
	);
});
