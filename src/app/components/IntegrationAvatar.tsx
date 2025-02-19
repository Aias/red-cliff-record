import { useLoaderData } from '@tanstack/react-router';
import { type IntegrationType } from '@/server/db/schema/operations';
import { Avatar, type AvatarProps } from './Avatar';
import adobeLogo from './logos/adobe.svg?url';
import airtableLogo from './logos/airtable.svg?url';
import arcLogo from './logos/arc.svg?url';
import githubLogoDark from './logos/github_dark.svg?url';
import githubLogoLight from './logos/github_light.svg?url';
import raindropLogo from './logos/raindrop.svg?url';
import readwiseLogo from './logos/readwise.svg?url';
import xLogoDark from './logos/x_dark.svg?url';
import xLogoLight from './logos/x_light.svg?url';

interface ServiceAvatarProps extends Omit<AvatarProps, 'src' | 'fallback'> {
	integration: IntegrationType;
}

export function IntegrationAvatar({
	integration: service,
	className,
	...props
}: ServiceAvatarProps) {
	const { theme } = useLoaderData({
		from: '__root__',
	});

	let logoUrl;
	switch (service) {
		case 'lightroom':
			logoUrl = adobeLogo;
			break;
		case 'airtable':
			logoUrl = airtableLogo;
			break;
		case 'browser_history':
			logoUrl = arcLogo;
			break;
		case 'github':
			logoUrl = theme === 'light' ? githubLogoLight : githubLogoDark;
			break;
		case 'raindrop':
			logoUrl = raindropLogo;
			break;
		case 'readwise':
			logoUrl = readwiseLogo;
			break;
		case 'twitter':
			logoUrl = theme === 'light' ? xLogoLight : xLogoDark;
			break;
		default:
			logoUrl = undefined;
	}

	return (
		<Avatar
			className={className}
			src={logoUrl}
			fallback={service.charAt(0).toUpperCase()}
			themed={false}
			{...props}
		/>
	);
}
