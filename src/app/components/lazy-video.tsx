import React from 'react';

export interface LazyVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
	/** Controls browser lazy loading hint */
	loading?: 'lazy' | 'eager';
}

export const LazyVideo = React.forwardRef<HTMLVideoElement, LazyVideoProps>(function LazyVideo(
	{ loading = 'lazy', preload = 'none', ...props },
	ref
) {
	return React.createElement('video', {
		ref,
		preload,
		loading,
		...props,
	});
});

export default LazyVideo;
