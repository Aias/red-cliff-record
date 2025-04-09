import { memo, useMemo } from 'react';
import { useLoaderData } from '@tanstack/react-router';
import { type IntegrationType } from '@/server/db/schema/operations';
import { Avatar, type AvatarProps } from './avatar';
import adobeLogo from './logos/adobe.svg?url';
import airtableLogo from './logos/airtable.svg?url';
import arcLogo from './logos/arc.svg?url';
import githubLogoDark from './logos/github_dark.svg?url';
import githubLogoLight from './logos/github_light.svg?url';
import raindropLogo from './logos/raindrop.svg?url';
import readwiseLogo from './logos/readwise.svg?url';
import xLogoDark from './logos/x_dark.svg?url';
import xLogoLight from './logos/x_light.svg?url';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface IntegrationLogoProps extends Omit<AvatarProps, 'src' | 'fallback'> {
	integration: IntegrationType;
}

const getLogoUrl = (service: IntegrationType, theme: 'light' | 'dark'): string | undefined => {
	switch (service) {
		case 'lightroom':
			return adobeLogo;
		case 'airtable':
			return airtableLogo;
		case 'browser_history':
			return arcLogo;
		case 'github':
			return theme === 'light' ? githubLogoLight : githubLogoDark;
		case 'raindrop':
			return raindropLogo;
		case 'readwise':
			return readwiseLogo;
		case 'twitter':
			return theme === 'light' ? xLogoLight : xLogoDark;
		default:
			return undefined;
	}
};

export const IntegrationLogo = memo(function IntegrationLogo({
	integration: service,
	...props
}: IntegrationLogoProps) {
	const { theme } = useLoaderData({
		from: '__root__',
	});

	const logoUrl = useMemo(() => getLogoUrl(service, theme), [service, theme]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Avatar
					src={logoUrl}
					fallback={service.charAt(0).toUpperCase()}
					themed={false}
					{...props}
				/>
			</TooltipTrigger>
			<TooltipContent>
				<span className="capitalize">{service}</span>
			</TooltipContent>
		</Tooltip>
	);
});
