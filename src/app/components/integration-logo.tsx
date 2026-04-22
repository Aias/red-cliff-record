import type { IntegrationType } from '@hozo/schema/operations';
import { memo } from 'react';
import { assertNever } from '@/shared/lib/type-utils';
import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';
import { AdobeLogo } from './logos/adobe';
import { AirtableLogo } from './logos/airtable';
import { ArcLogo } from './logos/arc';
import { GithubLogo } from './logos/github';
import { RaindropLogo } from './logos/raindrop';
import { ReadwiseLogo } from './logos/readwise';
import { XLogo } from './logos/x';
import { Tooltip } from './tooltip';

const LogoWrapper = styled('div', {
  base: {
    display: 'inline-grid',
    placeItems: 'center',
  },
});

interface IntegrationLogoProps extends ComponentProps<typeof LogoWrapper> {
  integration: IntegrationType;
}

const LogoComponent = ({ service }: { service: IntegrationType }) => {
  switch (service) {
    case 'lightroom':
      return <AdobeLogo />;
    case 'airtable':
      return <AirtableLogo />;
    case 'browser_history':
      return <ArcLogo />;
    case 'github':
      return <GithubLogo />;
    case 'raindrop':
      return <RaindropLogo />;
    case 'readwise':
      return <ReadwiseLogo />;
    case 'twitter':
      return <XLogo />;
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
  ...props
}: IntegrationLogoProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <LogoWrapper {...props}>
            <LogoComponent service={service} />
          </LogoWrapper>
        }
      />
      <Tooltip.Content css={{ textTransform: 'capitalize' }}>{service}</Tooltip.Content>
    </Tooltip.Root>
  );
});
