import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
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
const dataListRootVariants = cva(
	'break-words font-normal not-italic text-left', // base classes
	{
		variants: {
			orientation: {
				vertical: 'flex flex-col',
				horizontal: 'grid grid-cols-[auto_1fr]',
			},
			// If you want to replicate the "size" or "trim" variants, you can adapt them here:
			size: {
				1: 'text-xs',
				2: 'text-sm',
				3: 'text-base',
			},
			trim: {
				normal: '',
				start: '',
				end: '',
				both: '',
			},
		},
		compoundVariants: [
			{
				orientation: 'horizontal',
				size: 1,
				className: 'gap-x-3 gap-y-1',
			},
			{
				orientation: 'horizontal',
				size: 2,
				className: 'gap-x-5 gap-y-2',
			},
			{
				orientation: 'horizontal',
				size: 3,
				className: 'gap-x-5 gap-y-3',
			},
			{
				orientation: 'vertical',
				size: 1,
				className: 'gap-1',
			},
			{
				orientation: 'vertical',
				size: 2,
				className: 'gap-2',
			},
			{
				orientation: 'vertical',
				size: 3,
				className: 'gap-3',
			},
		],
		defaultVariants: {
			orientation: 'horizontal',
			size: 2,
			trim: 'normal',
		},
	}
);

interface DataListRootProps
	extends React.HTMLAttributes<HTMLDListElement>,
		VariantProps<typeof dataListRootVariants> {
	asChild?: boolean;
}

const DataListRoot = React.forwardRef<HTMLDListElement, DataListRootProps>(
	({ className, orientation, size, trim, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'dl';

		return (
			<DataListOrientationContext.Provider value={orientation || 'horizontal'}>
				<Comp
					ref={ref}
					className={cn(dataListRootVariants({ orientation, size, trim }), className)}
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
			horizontal: 'contents', // so dt/dd go into the root's 2-column grid
			vertical: 'flex flex-col gap-1',
		},
		// If you need alignment variants, you can handle them for vertical or do custom styling for dt/dd.
		alignment: {
			baseline: '',
			start: '',
			center: '',
			end: '',
			stretch: '',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
		alignment: 'baseline',
	},
});

interface DataListItemProps
	extends React.HTMLAttributes<HTMLDivElement>,
		Pick<VariantProps<typeof dataListItemVariants>, 'alignment'> {
	className?: string;
}

const DataListItem = React.forwardRef<HTMLDivElement, DataListItemProps>(
	({ className, alignment, ...props }, ref) => {
		const orientation = React.useContext(DataListOrientationContext);

		return (
			<div
				ref={ref}
				// Because 'display: contents' won't wrap dt/dd in a visible container,
				// if you need background or click handlers, you'll have to do a different approach.
				className={cn(dataListItemVariants({ orientation, alignment }), className)}
				{...props}
			/>
		);
	}
);
DataListItem.displayName = 'DataList.Item';

//
// 4) LABEL STYLES & COMPONENT
//
// - By default, label uses text-rcr-secondary. If `contrast` is true, use text-rcr-display.
// - If `accent` is true, apply the “themed” class (which presumably sets accent variables).
//
const dataListLabelVariants = cva('m-0', {
	variants: {
		accent: {
			true: 'themed',
			false: '',
		},
		contrast: {
			true: 'text-rcr-display', // high contrast text
			false: 'text-rcr-secondary', // default label color
		},
	},
	defaultVariants: {
		accent: false,
		contrast: false,
	},
});

interface DataListLabelProps
	extends React.HTMLAttributes<HTMLElement>,
		VariantProps<typeof dataListLabelVariants> {
	asChild?: boolean;
}

const DataListLabel = React.forwardRef<HTMLElement, DataListLabelProps>(
	({ className, accent, contrast, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'dt';
		return (
			<Comp
				ref={ref}
				className={cn(dataListLabelVariants({ accent, contrast }), className)}
				{...props}
			/>
		);
	}
);
DataListLabel.displayName = 'DataList.Label';

//
// 5) VALUE STYLES & COMPONENT
//
// - By default, value uses text-rcr-primary. If `contrast` is true, text-rcr-display.
// - Also allow `accent` => “themed” class.
//
const dataListValueVariants = cva('m-0 min-w-0', {
	variants: {
		accent: {
			true: 'themed',
			false: '',
		},
		contrast: {
			true: 'text-rcr-display',
			false: 'text-rcr-primary',
		},
	},
	defaultVariants: {
		accent: false,
		contrast: false,
	},
});

interface DataListValueProps
	extends React.HTMLAttributes<HTMLElement>,
		VariantProps<typeof dataListValueVariants> {
	asChild?: boolean;
}

const DataListValue = React.forwardRef<HTMLElement, DataListValueProps>(
	({ className, accent, contrast, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'dd';
		return (
			<Comp
				ref={ref}
				className={cn(dataListValueVariants({ accent, contrast }), className)}
				{...props}
			/>
		);
	}
);
DataListValue.displayName = 'DataList.Value';

//
// 6) EXPORT
//
export type {
	DataListItemProps as ItemProps,
	DataListLabelProps as LabelProps,
	DataListRootProps as RootProps,
	DataListValueProps as ValueProps,
};
export {
	DataListItem as Item,
	DataListLabel as Label,
	DataListRoot as Root,
	DataListValue as Value,
};
