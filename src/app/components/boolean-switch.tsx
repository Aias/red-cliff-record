import { cn } from '@/lib/utils';
import { Label } from './label';
import { Switch } from './switch';

interface BooleanSwitchProps extends React.ComponentProps<typeof Label> {
  label: string;
  value: boolean | undefined;
  handleChange: (value: boolean) => void;
  switchProps?: React.ComponentProps<typeof Switch>;
}

export const BooleanSwitch = ({
  label,
  value,
  handleChange,
  switchProps,
  className,
  ...props
}: BooleanSwitchProps) => {
  return (
    <Label className={cn('inline-flex items-center gap-2', className)} {...props}>
      <Switch checked={value} onCheckedChange={handleChange} {...switchProps} />
      <span>{label}</span>
    </Label>
  );
};
