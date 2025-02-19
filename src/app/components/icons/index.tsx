import React from 'react';
import {
	ArchiveIcon as ArchiveIconRadix,
	CheckCircledIcon as CheckCircledIconRadix,
	CheckIcon as CheckIconRadix,
	ChevronDownIcon as ChevronDownIconRadix,
	ChevronLeftIcon as ChevronLeftIconRadix,
	ChevronRightIcon as ChevronRightIconRadix,
	ChevronUpIcon as ChevronUpIconRadix,
	CircleIcon as CircleIconRadix,
	CopyIcon as CopyIconRadix,
	Cross1Icon as Cross1IconRadix,
	CubeIcon as CubeIconRadix,
	ExternalLinkIcon as ExternalLinkIconRadix,
	ImageIcon as ImageIconRadix,
	Link2Icon as Link2IconRadix,
	MagnifyingGlassIcon as MagnifyingGlassIconRadix,
	MoonIcon as MoonIconRadix,
	PersonIcon as PersonIconRadix,
	QuestionMarkCircledIcon as QuestionMarkCircledIconRadix,
	SunIcon as SunIconRadix,
} from '@radix-ui/react-icons';

export type IconProps = Omit<React.ComponentPropsWithRef<'svg'>, 'children'>;

function wrapIcon(IconComponent: React.ComponentType<IconProps>) {
	const WrappedIcon = React.forwardRef<SVGSVGElement, IconProps>(({ className, ...rest }, ref) => {
		return (
			<IconComponent ref={ref} className={className ? `icon ${className}` : 'icon'} {...rest} />
		);
	});
	WrappedIcon.displayName = IconComponent.displayName || IconComponent.name || 'Icon';
	return WrappedIcon;
}

export const ArchiveIcon = wrapIcon(ArchiveIconRadix);
export const CategoryIcon = wrapIcon(ArchiveIconRadix);
export const CheckIcon = wrapIcon(CheckIconRadix);
export const ClearIcon = wrapIcon(Cross1IconRadix);
export const CloseIcon = wrapIcon(Cross1IconRadix);
export const CollapseIcon = wrapIcon(ChevronUpIconRadix);
export const CompleteIcon = wrapIcon(CheckCircledIconRadix);
export const ConnectIcon = wrapIcon(Link2IconRadix);
export const CopyIcon = wrapIcon(CopyIconRadix);
export const DayModeIcon = wrapIcon(SunIconRadix);
export const EntityIcon = wrapIcon(PersonIconRadix);
export const ExpandIcon = wrapIcon(ChevronDownIconRadix);
export const ExternalLinkIcon = wrapIcon(ExternalLinkIconRadix);
export const FormatIcon = wrapIcon(CubeIconRadix);
export const ImageIcon = wrapIcon(ImageIconRadix);
export const IncompleteIcon = wrapIcon(CircleIconRadix);
export const NextIcon = wrapIcon(ChevronRightIconRadix);
export const NightModeIcon = wrapIcon(MoonIconRadix);
export const PreviousIcon = wrapIcon(ChevronLeftIconRadix);
export const SearchIcon = wrapIcon(MagnifyingGlassIconRadix);
export const UnknownIcon = wrapIcon(QuestionMarkCircledIconRadix);
