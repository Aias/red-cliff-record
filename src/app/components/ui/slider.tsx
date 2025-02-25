import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const _values = React.useMemo(
		() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
		[value, defaultValue, min, max]
	);

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn(
						'absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
					)}
				/>
			</SliderPrimitive.Track>
			{Array.from({ length: _values.length }, (_, index) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={index}
					className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	);
}

type PositiveNegativeSliderProps = Omit<
	React.ComponentProps<typeof SliderPrimitive.Root>,
	'min' | 'max' | 'step'
> & {
	min?: number;
	max?: number;
	step?: number;
};

function PositiveNegativeSlider({
	className,
	defaultValue = [0],
	value,
	min = -2,
	max = 2,
	step = 1,
	...props
}: PositiveNegativeSliderProps) {
	const _value =
		React.useMemo(
			() => (Array.isArray(value) ? value[0] : Array.isArray(defaultValue) ? defaultValue[0] : 0),
			[value, defaultValue]
		) ?? 0;

	const isPositive = _value > 0;
	const isNegative = _value < 0;
	const zeroPosition = ((0 - min) / (max - min)) * 100;

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			step={step}
			className={cn(
				'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
			>
				{/* Zero marker */}
				<div
					className="absolute top-0 bottom-0 z-10 w-0.5 bg-muted-foreground/50"
					style={{ left: `${zeroPosition}%` }}
				/>

				{/* Negative range (left of zero) */}
				{isNegative && (
					<div
						className="absolute h-full bg-destructive"
						style={{
							left: `${((_value - min) / (max - min)) * 100}%`,
							width: `${((0 - _value) / (max - min)) * 100}%`,
						}}
					/>
				)}

				{/* Positive range (right of zero) */}
				{isPositive && (
					<div
						className="absolute h-full bg-primary"
						style={{
							left: `${zeroPosition}%`,
							width: `${(_value / (max - min)) * 100}%`,
						}}
					/>
				)}
			</SliderPrimitive.Track>

			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
			/>
		</SliderPrimitive.Root>
	);
}

export { PositiveNegativeSlider, Slider };
