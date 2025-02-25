import React from 'react';
import {
	ArchiveIcon as ArchiveIconRadix,
	BellIcon as BellIconRadix,
	CalendarIcon as CalendarIconRadix,
	CheckCircledIcon as CheckCircledIconRadix,
	CheckIcon as CheckIconRadix,
	ChevronDownIcon as ChevronDownIconRadix,
	ChevronLeftIcon as ChevronLeftIconRadix,
	ChevronRightIcon as ChevronRightIconRadix,
	ChevronUpIcon as ChevronUpIconRadix,
	CircleIcon as CircleIconRadix,
	ClockIcon as ClockIconRadix,
	ColorWheelIcon as ColorWheelIconRadix,
	CopyIcon as CopyIconRadix,
	Cross1Icon as Cross1IconRadix,
	CubeIcon as CubeIconRadix,
	ExternalLinkIcon as ExternalLinkIconRadix,
	FileTextIcon as FileTextIconRadix,
	GlobeIcon as GlobeIconRadix,
	Half1Icon as Half1IconRadix,
	ImageIcon as ImageIconRadix,
	Link2Icon as Link2IconRadix,
	LinkBreak1Icon as LinkBreak1IconRadix,
	LockClosedIcon as LockClosedIconRadix,
	LockOpen2Icon as LockOpen2IconRadix,
	MagnifyingGlassIcon as MagnifyingGlassIconRadix,
	MoonIcon as MoonIconRadix,
	PersonIcon as PersonIconRadix,
	QuestionMarkCircledIcon as QuestionMarkCircledIconRadix,
	StarFilledIcon as StarFilledIconRadix,
	StarIcon as StarIconRadix,
	SunIcon as SunIconRadix,
	TrashIcon as TrashIconRadix,
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

// Semantic Mappings
export const CheckIcon = wrapIcon(CheckIconRadix);
export const CircleIcon = wrapIcon(CircleIconRadix);
export const ClearIcon = wrapIcon(Cross1IconRadix);
export const CloseIcon = wrapIcon(Cross1IconRadix);
export const DeleteIcon = wrapIcon(TrashIconRadix);
export const CopyIcon = wrapIcon(CopyIconRadix);
export const SearchIcon = wrapIcon(MagnifyingGlassIconRadix);

export const ChevronDownIcon = wrapIcon(ChevronDownIconRadix);
export const ChevronLeftIcon = wrapIcon(ChevronLeftIconRadix);
export const ChevronRightIcon = wrapIcon(ChevronRightIconRadix);
export const ChevronUpIcon = wrapIcon(ChevronUpIconRadix);

export const DayModeIcon = wrapIcon(SunIconRadix);
export const NightModeIcon = wrapIcon(MoonIconRadix);
export const StarFilledIcon = wrapIcon(StarFilledIconRadix);
export const StarIcon = wrapIcon(StarIconRadix);

export const ArchiveIcon = wrapIcon(ArchiveIconRadix);
export const IndexIcon = wrapIcon(ArchiveIconRadix);
export const EntityIcon = wrapIcon(PersonIconRadix);
export const FormatIcon = wrapIcon(CubeIconRadix);
export const ConceptIcon = wrapIcon(ArchiveIconRadix);
export const MediaIcon = wrapIcon(ImageIconRadix);
export const ArtifactIcon = wrapIcon(FileTextIconRadix);
export const EventIcon = wrapIcon(CalendarIconRadix);
export const PlaceIcon = wrapIcon(GlobeIconRadix);
export const SystemIcon = wrapIcon(ColorWheelIconRadix);

export const ExternalLinkIcon = wrapIcon(ExternalLinkIconRadix);
export const LinkIcon = wrapIcon(Link2IconRadix);
export const UnlinkIcon = wrapIcon(LinkBreak1IconRadix);

export const CompleteIcon = wrapIcon(CheckCircledIconRadix);
export const IncompleteIcon = wrapIcon(CircleIconRadix);
export const PrivateIcon = wrapIcon(LockClosedIconRadix);
export const PublicIcon = wrapIcon(LockOpen2IconRadix);
export const CuratedIcon = wrapIcon(CheckCircledIconRadix);
export const UncuratedIcon = wrapIcon(Half1IconRadix);
export const ReminderIcon = wrapIcon(BellIconRadix);
export const TimeIcon = wrapIcon(ClockIconRadix);

export const UnknownIcon = wrapIcon(QuestionMarkCircledIconRadix);
