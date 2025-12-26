import { memo } from 'react';
import type { IntegrationType } from '@aias/hozo';
import { AdobeLogo } from './logos/adobe';
import { AirtableLogo } from './logos/airtable';
import { ArcLogo } from './logos/arc';
import { GithubLogo } from './logos/github';
import { RaindropLogo } from './logos/raindrop';
import { ReadwiseLogo } from './logos/readwise';
import { XLogo } from './logos/x';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface IntegrationLogoProps {
	integration: IntegrationType;
	className?: string;
}

const LogoComponent = ({
	service,
	className,
}: {
	service: IntegrationType;
	className?: string;
}) => {
	switch (service) {
		case 'lightroom':
			return <AdobeLogo className={className} />;
		case 'airtable':
			return <AirtableLogo className={className} />;
		case 'browser_history':
			return <ArcLogo className={className} />;
		case 'github':
			return <GithubLogo className={className} />;
		case 'raindrop':
			return <RaindropLogo className={className} />;
		case 'readwise':
			return <ReadwiseLogo className={className} />;
		case 'twitter':
			return <XLogo className={className} />;
		default:
			return null;
	}
};

export const IntegrationLogo = memo(function IntegrationLogo({
	integration: service,
	className,
}: IntegrationLogoProps) {
	return (
		<Tooltip>
			<TooltipTrigger render={<div className={className} />}>
				<LogoComponent service={service} />
			</TooltipTrigger>
			<TooltipContent>
				<span className="capitalize">{service}</span>
			</TooltipContent>
		</Tooltip>
	);
});
