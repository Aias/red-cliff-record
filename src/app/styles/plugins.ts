import type { PropertyConfig } from '@pandacss/dev';
import { defineUtility } from '@pandacss/dev';

// ---------------------------------------------------------------------------
// Composable enter/exit animation utilities
//
// Mirrors the tailwindcss-animate pattern: `animateIn`/`animateOut` set the
// animation name and initialize CSS custom properties; modifier utilities
// (`fadeIn`, `zoomIn`, `slideInX`, …) set individual properties that the
// `enter`/`exit` keyframes (in animations.ts) read.
// ---------------------------------------------------------------------------

const enterVarDefaults = {
  '--rcr-enter-opacity': 'initial',
  '--rcr-enter-scale': 'initial',
  '--rcr-enter-translate-x': 'initial',
  '--rcr-enter-translate-y': 'initial',
};

const exitVarDefaults = {
  '--rcr-exit-opacity': 'initial',
  '--rcr-exit-scale': 'initial',
  '--rcr-exit-translate-x': 'initial',
  '--rcr-exit-translate-y': 'initial',
};

const animateInUtility = defineUtility({
  className: 'animate-in',
  values: { type: 'boolean' },
  transform: (value) => {
    if (!value) return {};
    return { animationName: 'enter', animationDuration: '150ms', ...enterVarDefaults };
  },
});

const animateOutUtility = defineUtility({
  className: 'animate-out',
  values: { type: 'boolean' },
  transform: (value) => {
    if (!value) return {};
    return { animationName: 'exit', animationDuration: '150ms', ...exitVarDefaults };
  },
});

const fadeInUtility = defineUtility({
  className: 'fade-in',
  values: { type: 'number' },
  transform: (value) => ({ '--rcr-enter-opacity': String(value) }),
});

const fadeOutUtility = defineUtility({
  className: 'fade-out',
  values: { type: 'number' },
  transform: (value) => ({ '--rcr-exit-opacity': String(value) }),
});

const zoomInUtility = defineUtility({
  className: 'zoom-in',
  values: { type: 'number' },
  transform: (value) => ({ '--rcr-enter-scale': String(value) }),
});

const zoomOutUtility = defineUtility({
  className: 'zoom-out',
  values: { type: 'number' },
  transform: (value) => ({ '--rcr-exit-scale': String(value) }),
});

const slideInXUtility = defineUtility({
  className: 'slide-in-x',
  values: { type: 'string' },
  transform: (value) => ({ '--rcr-enter-translate-x': value }),
});

const slideInYUtility = defineUtility({
  className: 'slide-in-y',
  values: { type: 'string' },
  transform: (value) => ({ '--rcr-enter-translate-y': value }),
});

const slideOutXUtility = defineUtility({
  className: 'slide-out-x',
  values: { type: 'string' },
  transform: (value) => ({ '--rcr-exit-translate-x': value }),
});

const slideOutYUtility = defineUtility({
  className: 'slide-out-y',
  values: { type: 'string' },
  transform: (value) => ({ '--rcr-exit-translate-y': value }),
});

// ---------------------------------------------------------------------------

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

// Usage: `className={css({ mode: 'inverted' })}`
export const modeUtility = defineUtility({
  className: 'mode',
  values: ['normal', 'inverted', 'light', 'dark'],
  transform: (value) => {
    switch (value) {
      case 'inverted':
        return {
          colorScheme: 'var(--inverse-color-scheme)',
        };
      case 'light':
        return {
          colorScheme: 'light',
          '--inverse-color-scheme': 'dark',
        };
      case 'dark':
        return {
          colorScheme: 'dark',
          '--inverse-color-scheme': 'light',
        };
      case 'normal':
        return {
          colorScheme: 'inherit',
        };
      default:
        return undefined;
    }
  },
});

export const utilities: Record<string, PropertyConfig> = {
  animateIn: animateInUtility,
  animateOut: animateOutUtility,
  fadeIn: fadeInUtility,
  fadeOut: fadeOutUtility,
  zoomIn: zoomInUtility,
  zoomOut: zoomOutUtility,
  slideInX: slideInXUtility,
  slideInY: slideInYUtility,
  slideOutX: slideOutXUtility,
  slideOutY: slideOutYUtility,
  debug: debugUtility,
  translateCenter: translateCenterUtility,
  mode: modeUtility,
};
