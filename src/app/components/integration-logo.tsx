import { memo, useMemo } from 'react';
import { Avatar, type AvatarProps } from './avatar';
import adobeLogo from './logos/adobe.svg?url';
import airtableLogo from './logos/airtable.svg?url';
import arcLogo from './logos/arc.svg?url';
import githubLogo from './logos/github.svg?url';
import raindropLogo from './logos/raindrop.svg?url';
import readwiseLogo from './logos/readwise.svg?url';
import xLogo from './logos/x.svg?url';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { type IntegrationType } from '@/shared/types';

interface IntegrationLogoProps extends Omit<AvatarProps, 'src' | 'fallback'> {
	integration: IntegrationType;
}

const getLogoUrl = (service: IntegrationType): string | undefined => {
	switch (service) {
		case 'lightroom':
			return adobeLogo;
		case 'airtable':
			return airtableLogo;
		case 'browser_history':
			return arcLogo;
		case 'github':
			return githubLogo;
		case 'raindrop':
			return raindropLogo;
		case 'readwise':
			return readwiseLogo;
		case 'twitter':
			return xLogo;
		default:
			return undefined;
	}
};

export const IntegrationLogo = memo(function IntegrationLogo({
	integration: service,
	...props
}: IntegrationLogoProps) {
	const logoUrl = useMemo(() => getLogoUrl(service), [service]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Avatar src={logoUrl} themed={false} {...props} />
			</TooltipTrigger>
			<TooltipContent>
				<span className="capitalize">{service}</span>
			</TooltipContent>
		</Tooltip>
	);
});
