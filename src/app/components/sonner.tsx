import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { token } from '@/styled-system/tokens';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{
        '--normal-bg': token.var('colors.float'),
        '--normal-text': token.var('colors.primary'),
        '--normal-border': token.var('colors.border'),
      }}
      {...props}
    />
  );
};

export { Toaster };
