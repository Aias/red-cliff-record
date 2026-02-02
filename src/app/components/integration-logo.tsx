import type { IntegrationType } from '@hozo/schema/operations';
import { memo } from 'react';
import { assertNever } from '@/shared/lib/type-utils';
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
    case 'ai_chat':
    case 'crawler':
    case 'embeddings':
    case 'feedbin':
    case 'manual':
      return null;
    default:
      assertNever(service);
  }
};

export const IntegrationLogo = memo(function IntegrationLogo({
  integration: service,
  className,
}: IntegrationLogoProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={className}>
          <LogoComponent service={service} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <span className="capitalize">{service}</span>
      </TooltipContent>
    </Tooltip>
  );
});
