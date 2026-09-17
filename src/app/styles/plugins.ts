import type { PropertyConfig } from '@pandacss/dev';
import { defineUtility } from '@pandacss/dev';
import { borderDeclarations } from './borders';
import { chromaticDeclarations, paletteDeclarations, palettes, type PaletteName } from './colors';

// ---------------------------------------------------------------------------
// Composable enter/exit animation utilities
//
// Mirrors the tailwindcss-animate pattern: `animateIn`/`animateOut` set the
// animation name and initialize CSS custom properties; modifier utilities
// (`fadeIn`, `zoomIn`, `slideInX`, …) set individual properties that the
// `enter`/`exit` keyframes (in animations.ts) read.
// ---------------------------------------------------------------------------

const enterVarDefaults = {
  '--enter-opacity': 'initial',
  '--enter-scale': 'initial',
  '--enter-translate-x': 'initial',
  '--enter-translate-y': 'initial',
};

const exitVarDefaults = {
  '--exit-opacity': 'initial',
  '--exit-scale': 'initial',
  '--exit-translate-x': 'initial',
  '--exit-translate-y': 'initial',
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
  transform: (value) => ({ '--enter-opacity': String(value) }),
});

const fadeOutUtility = defineUtility({
  className: 'fade-out',
  values: { type: 'number' },
  transform: (value) => ({ '--exit-opacity': String(value) }),
});

const zoomInUtility = defineUtility({
  className: 'zoom-in',
  values: { type: 'number' },
  transform: (value) => ({ '--enter-scale': String(value) }),
});

const zoomOutUtility = defineUtility({
  className: 'zoom-out',
  values: { type: 'number' },
  transform: (value) => ({ '--exit-scale': String(value) }),
});

const slideInXUtility = defineUtility({
  className: 'slide-in-x',
  values: { type: 'string' },
  transform: (value) => ({ '--enter-translate-x': value }),
});

const slideInYUtility = defineUtility({
  className: 'slide-in-y',
  values: { type: 'string' },
  transform: (value) => ({ '--enter-translate-y': value }),
});

const slideOutXUtility = defineUtility({
  className: 'slide-out-x',
  values: { type: 'string' },
  transform: (value) => ({ '--exit-translate-x': value }),
});

const slideOutYUtility = defineUtility({
  className: 'slide-out-y',
  values: { type: 'string' },
  transform: (value) => ({ '--exit-translate-y': value }),
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

// ---------------------------------------------------------------------------
// Theme boundary utilities
//
// `palette`, `chromatic`, and `mode` each mark a theme boundary: they change
// an inherited input (ramp aliases, --chroma, color-scheme) and re-declare the
// semantic color formulas so the subtree re-resolves against the new context
// (see colors.ts). A base-layer rule in globals.ts re-asserts the default text
// color on boundary elements, so plain inherited text adapts across the
// boundary while explicit colors — recipe or atomic — still win the cascade.
// ---------------------------------------------------------------------------

const isPaletteName = (value: unknown): value is PaletteName =>
  typeof value === 'string' && value in palettes;

const paletteUtility = defineUtility({
  className: 'palette',
  values: Object.keys(palettes),
  transform: (value) => {
    if (!isPaletteName(value)) return {};
    return {
      ...paletteDeclarations(value),
      ...borderDeclarations,
    };
  },
});

const chromaticUtility = defineUtility({
  className: 'chromatic',
  values: { type: 'boolean' },
  transform: (value) => ({
    ...chromaticDeclarations(value === true),
    ...borderDeclarations,
  }),
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
  chromatic: chromaticUtility,
  mode: modeUtility,
  palette: paletteUtility,
};
