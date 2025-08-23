import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

//
// 1) ORIENTATION CONTEXT
//
const DataListOrientationContext = React.createContext<'horizontal' | 'vertical'>('horizontal');

//
// 2) ROOT STYLES & COMPONENT
//
// - For horizontal orientation, we set up a single 2-column grid: [auto, 1fr].
// - We also add gap-x for spacing between label & value, and gap-y for spacing between rows.
// - For vertical orientation, we do flex-col with a small gap between items.
const dataListRootVariants = cva('break-words font-normal not-italic text-left text-sm', {
	variants: {
		orientation: {
			vertical: 'flex flex-col gap-2',
			horizontal: 'grid grid-cols-[auto_1fr] gap-x-5 gap-y-2',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
	},
});

interface DataListRootProps
	extends React.HTMLAttributes<HTMLDListElement>,
		VariantProps<typeof dataListRootVariants> {
	asChild?: boolean;
}

const DataListRoot = React.forwardRef<HTMLDListElement, DataListRootProps>(
	({ className, orientation, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot.Root : 'dl';

		return (
			<DataListOrientationContext.Provider value={orientation || 'horizontal'}>
				<Comp
					ref={ref}
					className={cn(dataListRootVariants({ orientation }), className)}
					{...props}
				/>
			</DataListOrientationContext.Provider>
		);
	}
);
DataListRoot.displayName = 'DataList.Root';

//
// 3) ITEM STYLES & COMPONENT
//
// - For horizontal orientation, use `display: contents` so dt and dd occupy
//   the parent's columns, ensuring shared column widths for all items.
// - For vertical orientation, each item is a small flex-col with a gap between label and value.
const dataListItemVariants = cva('', {
	variants: {
		orientation: {
			horizontal: 'contents',
			vertical: 'flex flex-col gap-1',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
	},
});

interface DataListItemProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
}

const DataListItem = React.forwardRef<HTMLDivElement, DataListItemProps>(
	({ className, ...props }, ref) => {
		const orientation = React.useContext(DataListOrientationContext);

		return (
			<div ref={ref} className={cn(dataListItemVariants({ orientation }), className)} {...props} />
		);
	}
);
DataListItem.displayName = 'DataList.Item';

//
// 4) LABEL STYLES & COMPONENT
//

interface DataListLabelProps extends React.HTMLAttributes<HTMLElement> {
	asChild?: boolean;
}

const DataListLabel = React.forwardRef<HTMLElement, DataListLabelProps>(
	({ asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot.Root : 'dt';
		return <Comp ref={ref} {...props} />;
	}
);
DataListLabel.displayName = 'DataList.Label';

//
// 5) VALUE STYLES & COMPONENT
//

interface DataListValueProps extends React.HTMLAttributes<HTMLElement> {
	asChild?: boolean;
}

const DataListValue = React.forwardRef<HTMLElement, DataListValueProps>(
	({ asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot.Root : 'dd';
		return <Comp ref={ref} {...props} />;
	}
);
DataListValue.displayName = 'DataList.Value';

//
// 6) EXPORT
//
export type { DataListItemProps, DataListLabelProps, DataListRootProps, DataListValueProps };
export { DataListItem, DataListLabel, DataListRoot, DataListValue };
