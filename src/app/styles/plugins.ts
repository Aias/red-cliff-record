import { defineUtility } from '@pandacss/dev';

export const debugUtility = defineUtility({
  className: 'debug',
  values: { type: 'boolean' },
  transform: (value) => {
    if (!value) return {};
    return {
      // Base: all elements (including the container itself)
      '&, & :where(*, *::before, *::after)': {
        '--dbg-base': 'fuchsia',
        '--dbg-offset': '-1px',
        '--dbg-mix-1': `color-mix(in oklab, var(--dbg-base) 25%, transparent)`,
        '--dbg-mix-2': `color-mix(in oklab, var(--dbg-base) 50%, transparent)`, // hover/focus

        // Forced flush visual on the element's border box
        outline: '1px solid var(--dbg-mix-1) !important',
        outlineOffset: 'var(--dbg-offset, -1px) !important', // Outline should be directly on the border
      },

      // Hover/focus amplification
      '& :where(*:hover, *:focus, *::before:hover, *::after:hover)': {
        outlineColor: 'var(--dbg-mix-2) !important',
      },

      // Exclusions to reduce noise (non-rendered/meta only)
      '& :is(script, style, link, meta, base, title, template)': {
        outline: 'none !important',
      },

      // Keep the SVG element outlined; ignore its internal graphics
      '& svg': {
        // Slightly stronger to remain visible over artwork
        '--dbg-mix-1': `color-mix(in oklab, var(--dbg-base) 35%, transparent)`,
      },
      '& svg :is(g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, use, marker, clipPath, mask, pattern, filter, foreignObject, image)':
        {
          outline: 'none !important',
        },

      // Form controls: slightly stronger for clarity
      '& :is(input, textarea, select, button)': {
        '--dbg-mix-1': `color-mix(in oklab, var(--dbg-base) 30%, transparent)`,
      },

      // Focus-within subtle boost without offset
      '& *:focus-within': {
        '--dbg-mix-1': `color-mix(in oklab, var(--dbg-base) 40%, transparent)`,
      },
    };
  },
});

export const translateCenterUtility = defineUtility({
  className: 'translated',
  values: ['x', 'y', 'xy'],
  transform(value) {
    if (value === 'x') {
      return {
        translate: '-50% 0',
      };
    }
    if (value === 'y') {
      return {
        translate: '0 -50%',
      };
    }
    if (value === 'xy') {
      return {
        translate: '-50% -50%',
      };
    }
    return undefined;
  },
});

export const utilities = {
  debug: debugUtility,
  translateCenter: translateCenterUtility,
};
