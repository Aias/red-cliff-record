/**
 * Easing curves from "The Easing Blueprint" by Emil Kowalski.
 * @see https://animations.dev/easing
 *
 * Within each family, curves are ordered from weakest to strongest acceleration:
 * quad → cubic → quart → quint → expo → circ
 */

import { defineKeyframes, defineTokens } from '@pandacss/dev';

/** Curve intensity levels, ordered from weakest to strongest acceleration */
export type CurveIntensity = 'quad' | 'cubic' | 'quart' | 'quint' | 'expo' | 'circ';

/** Easing families based on animation context */
export type EasingFamily = 'ease-out' | 'ease-in-out';

/** A cubic-bezier curve represented as [x1, y1, x2, y2] */
export type CubicBezierCurve = readonly [number, number, number, number];

/** All easing curves organized by family and intensity */
export type EasingCurves = {
  readonly [F in EasingFamily]: {
    readonly [I in CurveIntensity]: CubicBezierCurve;
  };
};

/**
 * Raw easing curve values as cubic-bezier control points.
 *
 * Use `ease-out` for elements entering/exiting the screen (dropdowns, modals, toasts).
 * Fast start feels responsive; gentle landing feels natural.
 *
 * Use `ease-in-out` for elements already on screen that move or morph (toggles, expanding panels).
 * Mimics natural acceleration/deceleration like a car.
 */
export const easingCurves = {
  'ease-out': {
    quad: [0.25, 0.46, 0.45, 0.94],
    cubic: [0.215, 0.61, 0.355, 1],
    quart: [0.165, 0.84, 0.44, 1],
    quint: [0.23, 1, 0.32, 1],
    expo: [0.19, 1, 0.22, 1],
    circ: [0.075, 0.82, 0.165, 1],
  },
  'ease-in-out': {
    quad: [0.455, 0.03, 0.515, 0.955],
    cubic: [0.645, 0.045, 0.355, 1],
    quart: [0.77, 0, 0.175, 1],
    quint: [0.86, 0, 0.07, 1],
    expo: [1, 0, 0, 1],
    circ: [0.785, 0.135, 0.15, 0.86],
  },
} as const satisfies EasingCurves;

/** Convert a cubic-bezier curve to a CSS string */
export const curveToCSS = (curve: CubicBezierCurve): string => `cubic-bezier(${curve.join(', ')})`;

/** Get a specific easing curve as a CSS cubic-bezier string */
export const getEasing = (family: EasingFamily, intensity: CurveIntensity): string =>
  curveToCSS(easingCurves[family][intensity]);

export const easings = defineTokens.easings({
  easeOut: {
    quad: { value: getEasing('ease-out', 'quad') },
    cubic: { value: getEasing('ease-out', 'cubic') },
    quart: { value: getEasing('ease-out', 'quart') },
    quint: { value: getEasing('ease-out', 'quint') },
    expo: { value: getEasing('ease-out', 'expo') },
    circ: { value: getEasing('ease-out', 'circ') },
  },
  easeInOut: {
    quad: { value: getEasing('ease-in-out', 'quad') },
    cubic: { value: getEasing('ease-in-out', 'cubic') },
    quart: { value: getEasing('ease-in-out', 'quart') },
    quint: { value: getEasing('ease-in-out', 'quint') },
    expo: { value: getEasing('ease-in-out', 'expo') },
    circ: { value: getEasing('ease-in-out', 'circ') },
  },
  linear: { value: 'linear' },
});

export const durations = defineTokens.durations({
  0: { value: '0ms' },
  50: { value: '50ms' },
  100: { value: '100ms' },
  150: { value: '150ms' },
  200: { value: '200ms' },
  250: { value: '250ms' },
  300: { value: '300ms' },
  350: { value: '350ms' },
  400: { value: '400ms' },
  500: { value: '500ms' },
});

export const keyframes = defineKeyframes({
  spinnerLeafFade: {
    from: {
      opacity: 1,
    },
    to: {
      opacity: 0.25,
    },
  },
});
