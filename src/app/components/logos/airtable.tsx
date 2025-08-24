import { cn } from '@/app/lib/utils';

export const AirtableLogo = ({ className }: { className?: string }) => {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 101 101" className={cn('icon', className)}>
			<title>Airtable</title>
			<g clipPath="url(#a)">
				<path
					fill="#FFBF00"
					d="M45.132 9.563 7.867 24.983c-2.072.857-2.05 3.8.035 4.627l37.42 14.84a13.884 13.884 0 0 0 10.238 0l37.421-14.84c2.085-.826 2.107-3.77.034-4.627L55.751 9.563a13.886 13.886 0 0 0-10.619 0Z"
					style={{ fill: '#ffbf00', fillOpacity: 1 }}
				/>
				<path
					fill="#26B5F8"
					d="M53.761 52.553v37.072a2.497 2.497 0 0 0 3.417 2.32L98.877 75.76a2.496 2.496 0 0 0 1.576-2.32V36.367a2.497 2.497 0 0 0-3.417-2.32L55.338 50.232a2.497 2.497 0 0 0-1.577 2.32Z"
					style={{ fill: '#26b5f8', fillOpacity: 1 }}
				/>
				<path
					fill="#ED3049"
					d="m44.025 54.466-12.376 5.975-1.256.608L4.27 73.566C2.614 74.365.5 73.158.5 71.318V36.524c0-.666.341-1.24.8-1.673.19-.191.406-.35.631-.474.625-.375 1.515-.475 2.272-.175l39.614 15.695c2.013.8 2.171 3.62.208 4.57Z"
					style={{ fill: '#ed3049', fillOpacity: 1 }}
				/>
				<path
					fill="#000"
					fillOpacity=".25"
					d="m44.025 54.466-12.376 5.975L1.3 34.851c.191-.191.407-.35.632-.474.625-.375 1.515-.475 2.272-.175l39.614 15.695c2.013.8 2.171 3.62.208 4.57Z"
					style={{ fill: '#000', fillOpacity: 0.25 }}
				/>
			</g>
			<defs>
				<clipPath id="a">
					<path
						fill="#fff"
						d="M0 0h100v100H0z"
						style={{ fill: '#fff', fillOpacity: 1 }}
						transform="translate(.5 .5)"
					/>
				</clipPath>
			</defs>
		</svg>
	);
};
