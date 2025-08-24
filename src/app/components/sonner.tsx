import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			style={
				{
					'--normal-bg': 'var(--color-c-float)',
					'--normal-text': 'var(--color-c-primary)',
					'--normal-border': 'var(--color-c-border)',
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
