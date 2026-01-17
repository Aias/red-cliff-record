import React from 'react';

export interface LazyVideoProps extends React.ComponentPropsWithRef<'video'> {
  /** Controls browser lazy loading hint */
  loading?: 'lazy' | 'eager';
}

export const LazyVideo = function LazyVideo({
  loading = 'lazy',
  preload = 'none',
  ...props
}: LazyVideoProps) {
  return React.createElement('video', {
    preload,
    loading,
    ...props,
  });
};

export default LazyVideo;
