import { ExternalLinkIcon } from 'lucide-react';
import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';

const Anchor = styled(
  'a',
  {
    base: {
      _childIcon: {
        transitionProperty: '[opacity]',
        transitionDuration: '150',
        transitionTimingFunction: 'easeOut.quad',
        opacity: '50%',
      },
      _hover: {
        _childIcon: {
          opacity: '100%',
        },
      },
    },
  },
  {
    defaultProps: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }
);

export const ExternalLink = ({
  href,
  children = 'Open',
  ...props
}: ComponentProps<typeof styled.a>) => {
  return (
    <Anchor href={href} aria-label={children ? undefined : 'Open in new tab'} {...props}>
      {children}
      <ExternalLinkIcon />
    </Anchor>
  );
};
