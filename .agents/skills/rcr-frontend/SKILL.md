---
name: rcr-frontend
description: Component and styling conventions for Red Cliff Record. Use when writing, reviewing, or refactoring any frontend code under `src/app/` — components, routes, styles, forms, icons, animations. Triggers on `.tsx`/`.css` edits in this project, design tokens, Panda CSS recipes, Base UI primitives, TanStack Form/Router, Lucide icons, color palettes (`data-palette`, `colorPalette`), or questions like "how do I style X in RCR". Also invoke proactively before UI work to ensure Panda-first styling and Base UI primitives, and to clean up legacy Tailwind/Radix in any file you touch.
---

# RCR Frontend

Supplements global `react-best-practices` and `code-quality` skills.

## Source of truth

- **Panda CSS is canonical.** All new frontend code uses Panda style props, tokens, and recipes.
- **Base UI is canonical.** Headless primitives come from `@base-ui/react`, not `radix-ui` or `@radix-ui/*`.
- **Tailwind and Radix are legacy**, present only because the migration is in progress. Any file you touch should be cleaned up:
  - Replace Tailwind class strings (`className="..."`, `cn(...)`, `c-*` color aliases) with Panda style objects.
  - Replace `radix-ui` primitives with `@base-ui/react` equivalents.
  - Remove now-unused imports (`cn`, `css` from `@/styled-system/css` if no longer needed, `radix-ui`, `lucide-react` sizing props).
- Do not introduce new Tailwind utilities or Radix imports, even as a bridge. If Panda lacks something you need, ask — don't fall back to Tailwind.
- When translating legacy Tailwind to Panda, see `references/tailwind-to-panda.md` for the token mapping tables (colors, radius, sizes), idiom translations, and the bracket-literal decision tree.

## Component organization

- Reusable components: `src/app/components/` (kebab-case).
- **Simple component** → single file: `src/app/components/badge.tsx`.
- **Component with a recipe** → folder with colocated recipe: `src/app/components/button/{index.tsx, button.recipe.ts}`.
- **Multi-slot component** → folder with slot recipe and primitives: `src/app/components/scroll-area/{scroll-area.recipe.ts, scroll-area.tsx, index.ts}` (Base UI + `createStyleContext`) or `alert-dialog/` (legacy Radix, pending migration).
- **Page-specific components** → `-components/` folder adjacent to the route or `-component.tsx` suffix (TanStack Router convention for excluded directories).
- Register new recipes in `panda.config.ts` (`theme.extend.recipes` for single, `theme.extend.slotRecipes` for slot) and run `bun run stylegen` so `src/app/styled-system/recipes` updates.

## Styling API — preference order

1. **`css` prop on `styled()` components** — `<Button css={{ marginBlockStart: '4' }}>`. Preferred wherever available.
2. **`styled.*` elements** — `<styled.div css={{ display: 'flex' }}>` for HTML elements that need styles.
3. **`css()` function** — `className={css({ ... })}` when working with an element that doesn't expose `css` (rare, e.g. third-party components).
4. **`cx()`** — only to merge class names. Don't use `cn()` / `tailwind-merge` in new code; that utility is scoped to the remaining Tailwind surface.

`jsxStyleProps: 'minimal'` is set in `panda.config.ts`, so individual style props (`<styled.div bg="red">`) are **not** available — always use the `css` prop.

**Prop types come from Panda, not React.** When typing a design-system component that composes Panda-styled primitives (`styled()`, `withContext`, recipe-bound), import `ComponentProps` / `ComponentPropsWithRef` from `@/styled-system/types`, not from `react` — the Panda types include the `css` prop, recipe variants, and `unstyled`. React's `ComponentProps` is fine for non-Panda components elsewhere in the app.

### Composing style objects — `css.raw()`

Use `css.raw()` to merge style objects for the **`css` prop**. Don't spread one object into another (`{ ...base, ...specific }`) — Panda's static extractor can't reliably analyze spreads.

- **Reusable chunks** → name a module-scope `css.raw({ ... })` const.
- **One-off composition** → `css={css.raw(chunkA, chunkB, { ...local })}`.
- **Consumer overrides** → last argument: `css={css.raw(baseStyles, cssProp)}`.
- **`css()` vs `css.raw()`** — `css()` emits a **class name** (`className={css({ ... })}` on elements without a `css` prop, e.g. third-party hosts). `css.raw()` returns a **style object** for the `css` prop only; don't assign its result to `className`.

```tsx
const revealOnGroupCss = css.raw({
  opacity: 0,
  _groupHover: { opacity: 1 },
  _groupFocusWithin: { opacity: 1 },
});

<styled.div
  className="group"
  css={css.raw(revealOnGroupCss, { position: 'absolute', inset: '0' })}
/>;

export function Toolbar({ css: cssProp }: { css?: SystemStyleObject }) {
  return <styled.div css={css.raw({ display: 'flex', gap: '2' }, cssProp)} />;
}
```

## Panda fundamentals

- **`strictTokens: true`** and **`strictPropertyValues: true`** — every value must be a defined token or a bracket-escaped literal. If TS errors on a color/spacing value, either use a token or confirm a bracket literal is truly unavoidable.
- **No shorthands.** `shorthands: false` in the config. Write `marginBlockStart`, `paddingInline`, `backgroundColor`, `flexDirection` — not `mt`, `px`, `bg`, `flexDir`.
- **Logical properties** over physical: `inlineStart`/`inlineEnd`/`blockStart`/`blockEnd`, `paddingInline`/`paddingBlock`, `borderInlineStart`. Reserve `left`/`right`/`top`/`bottom` for actual positioning semantics (e.g. `position: 'absolute'` with `insetBlockStart`).
- **`boxSize` when width and height match.** Same rule for `paddingInline`/`paddingBlock` over `paddingLeft` + `paddingRight`.
- **Declaration order** follows intent (outside-in): position/display → flex/grid container → flex/grid child → sizing/spacing → overflow → typography → visual → transforms/animation → interaction. Not alphabetical.
- **Static analysis.** Panda needs to parse style objects at build time — no dynamic values or runtime-computed keys in `css` objects. For dynamic numbers, use an inline `style` attribute; for dynamic variants, use `data-*` attributes and target them via selectors.
- **`[]` escape hatch** is for values the token scales can't express — other units or computed values (`boxSize: '[1.15em]'`, `backgroundSize: '[200% 100%]'`, `width: '[calc(100% - 2rem)]'`). If an exact token exists, use it. When a measurement falls _between_ scale steps — say a mock specifies `0.4rem` of gap while the spacing scale offers `1.5` (0.375rem) and `2` (0.5rem) — round to the nearest token instead of bracket-escaping the exact value; staying on the scale keeps the spacing rhythm consistent and beats a pixel-perfect literal. Reserve brackets for values with no scale neighbor at all. Use real spaces inside brackets — not underscores.
- **Token interpolation in compound values**: `border: '1px solid {colors.divider}'` (curly syntax), not `token(colors.divider)` unless providing a fallback.
- **Regenerate after config changes.** After editing recipes, tokens, conditions, or `panda.config.ts`, run `bun run stylegen` (`panda codegen && panda cssgen`) so `src/app/styled-system/*` is in sync.

## Tokens

Everything lives under `src/app/styles/`:

| File                                                       | Contents                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `colors.ts`                                                | Semantic tokens + semantic palettes + Radix color scales       |
| `typography.ts`                                            | `textStyle` values, font families, sizes, weights              |
| `dimensions.ts`                                            | `spacing` and `sizes` (multiples of `0.25rem`, plus fractions) |
| `borders.ts` / `radii.ts` / `shadows.ts` / `animations.ts` | Their namesakes                                                |
| `conditions.ts`                                            | Custom Panda conditions                                        |
| `plugins.ts`                                               | Custom utilities (`animateIn`, `fadeIn`, `translateCenter`, …) |

### Semantic color tokens (use these, not Radix scales directly)

`display`, `primary`, `secondary`, `muted`, `symbol`, `accent`, `accentActive`, `background`, `surface`, `container`, `float`, `divider`, `border`, `edge`, `focus`, `mist`, `splash`, `flood`, `main`, `mainActive`, `mainContrast`.

Use them as token names in Panda (`color: 'primary'`, `backgroundColor: 'float'`). The `c-*` names (`bg-c-paper`, `text-c-primary`) are the Tailwind aliases — only relevant while removing Tailwind from legacy components. In Panda code, `c-paper` doesn't exist; the equivalent is `float` or `surface` depending on intent (check existing usage).

### Palette-aware components via `colorPalette` and `layerStyle`

Two style properties steer semantic tokens within a subtree. Use them as Panda CSS properties — not HTML attributes.

| Property       | Values                                                      | Effect                                                                                                                                      |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `colorPalette` | `artifact`, `entity`, `concept`, `error`, `success`, `info` | Remaps every semantic color under this element to the chosen palette (tokens like `accent`, `main`, `splash` resolve through that palette). |
| `layerStyle`   | `chromatic`, `neutral`                                      | Picks the chromatic or neutral variant of the active palette. Activates the `_chromatic` / `_neutral` conditions inside recipes.            |

```tsx
<styled.span css={{ colorPalette: 'error', backgroundColor: 'splash', color: 'accent' }}>
  Error
</styled.span>

<styled.section css={{ colorPalette: 'info', layerStyle: 'chromatic' }}>
  {/* Uses the chromatic variant of the `info` palette inside */}
</styled.section>
```

Inside a recipe, gate a palette swap on a variant or condition — e.g. `_invalid: { colorPalette: 'error' }` on button/textarea input states.

**Escape hatch — `data-palette` / `data-chromatic`.** These HTML attributes still work (they're wired up in `src/app/styles/theme.css` and `conditions.ts`) and are fine when the element is rendered outside Panda's reach: third-party components that only accept HTML attributes, markdown-generated DOM, server-rendered bootstrap wrappers, etc. For anything authored with `css({ ... })` or `styled.*`, prefer `colorPalette` and `layerStyle`.

### Text styles

Use `textStyle` tokens (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`, ..., `9xl`) instead of pairing `fontSize` + `lineHeight` manually. They match Tailwind v4's `text-*` scale by design, so map `text-{size}` → `textStyle: '{size}'` **first**, then override `fontSize` / `lineHeight` / `fontWeight` **only** where the original diverges from that textStyle's bundled values. Never set a bare `fontSize` when a matching textStyle exists.

```tsx
<styled.h2 css={{ textStyle: 'xl', fontWeight: 'medium' }}>Section</styled.h2>
```

So `text-lg leading-none font-semibold` → `{ textStyle: 'lg', lineHeight: 'none', fontWeight: 'semibold' }` (textStyle for the size, then the two divergences), and a bare `text-sm` → `{ textStyle: 'sm' }`. Don't avoid `textStyle` just because you need to override its line-height — set it and override.

Headings `h1`–`h6` already get default text styles from `src/app/styles/globals.ts`; only override when the default is wrong for the context.

### Spacing and sizes

Numeric tokens are `0.25rem` multiples: `0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96`. Plus fractions (`1/5`, `1/4`, `1/3`, `1/2`, `2/3`, `3/4`, `4/5`, `full`), `em`, and `px`.

## Custom conditions and utilities

| Condition                                               | Selector                                        | Use for                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_dark`                                                 | `:where([data-color-scheme="dark"], .dark) &`   | Color-scheme-scoped overrides                                                                                                                                               |
| `_light`                                                | `:where([data-color-scheme="light"], .light) &` | Color-scheme-scoped overrides                                                                                                                                               |
| `_neutral`                                              | `&[data-neutral]` (+ scope variants)            | Triggered by `layerStyle: 'neutral'` (or `data-neutral` as escape hatch).                                                                                                   |
| `_chromatic`                                            | `&[data-chromatic]` (+ scope variants)          | Triggered by `layerStyle: 'chromatic'` (or `data-chromatic` as escape hatch).                                                                                               |
| `_childIcon`                                            | `& :where(svg, .icon, .lucide)`                 | Size/color icons inside a container. Prefer over `& svg`.                                                                                                                   |
| `_sideBottom` / `_sideTop` / `_sideLeft` / `_sideRight` | `&[data-side=<side>]`                           | Radix/popper-positioned content (popover, dropdown, hover-card) — directional slide-in animation per placement. Use these instead of raw `'&[data-side=bottom]'` selectors. |

Reach for a defined condition over a raw `[data-*]` selector — but **first check Panda's built-ins so you don't duplicate one**: `_vertical` / `_horizontal` (`[data-orientation]`), `_open` / `_closed` (`[data-state]`), `_hover`, `_focusVisible`, `_disabled`, `_invalid`, `_placeholder`, and the `_group*` / `_peer*` families all ship out of the box. Only when Panda has nothing (e.g. the project's `_side*`, `_chromatic` / `_neutral`) add it to `styles/conditions.ts` (and `bun run stylegen`) rather than inlining the attribute selector in a recipe.

Useful utilities (full list in `src/app/styles/plugins.ts`):

- `animateIn` / `animateOut` + modifiers `fadeIn`, `zoomIn`, `slideInX`, `slideInY` (and `*Out` variants) — compose enter/exit animations with the `enter`/`exit` keyframes.
- `translateCenter: 'x' | 'y' | 'xy'` — short for `translate: '-50% ...'`. Use for centered overlays **instead of** a raw `translate: '[-50% 0]'` / `'[0 -50%]'` / `'[-50% -50%]'` literal. (A centering offset combined with an extra nudge — e.g. `translate: '[0 calc(-50% - 2px)]'` for an arrow — still needs a bracket literal; `translateCenter` only covers the pure ±50% cases.)
- `mode: 'normal' | 'inverted' | 'light' | 'dark'` — flip or pin color scheme. `mode: 'inverted'` is the idiomatic way to punch out a dark island on a light page.
- `debug: true` — visual outline for layout debugging; remove before committing.

## Recipes

### Single-element — `defineRecipe`

```ts
import { defineRecipe } from '@/app/styles/define-recipe';

export const tagRecipe = defineRecipe({
  className: 'tag',
  base: { display: 'inline-flex', paddingInline: '2', borderRadius: 'sm' },
  variants: {
    variant: { solid: { ... }, soft: { ... } },
    size: { default: { height: '6' }, sm: { height: '5' } },
  },
  defaultVariants: { variant: 'solid', size: 'default' },
});
```

Always use `defineRecipe` / `defineSlotRecipe` from `@/app/styles/define-recipe` (not from `@pandacss/dev`). Those wrappers apply Panda's generated strict types so invalid props/values error at author time.

Bind single-element recipes with `styled()` from `@/styled-system/jsx`:

```tsx
import { Input as BaseInput } from '@base-ui/react/input';
import { styled } from '@/styled-system/jsx';
import { input } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Input = styled(BaseInput, input);
export type InputProps = ComponentProps<typeof Input>;
```

Same pattern for native elements (`styled('label', label)`) and non-Base UI hosts (`styled(Link, button)`). See `input/`, `button/`, `badge/`, `label/`, `separator/`.

### Multi-slot — `defineSlotRecipe` + `createStyleContext`

Registered slot recipes bind via `createStyleContext(slotRecipe)` → `withProvider` (root) + `withContext` (child slots). Canonical Base UI examples: `scroll-area/`, `tooltip/`. Legacy Radix still on `alert-dialog/` — migrate to Base UI when touched.

```tsx
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import { createStyleContext } from '@/styled-system/jsx';
import { scrollArea } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(scrollArea);

const Root = withProvider(BaseScrollArea.Root, 'root');
const Viewport = withContext(BaseScrollArea.Viewport, 'viewport');
const Content = withContext(BaseScrollArea.Content, 'content');
const ScrollBar = withContext(BaseScrollArea.Scrollbar, 'scrollbar');
const Corner = withContext(BaseScrollArea.Corner, 'corner');
const Thumb = withContext(BaseScrollArea.Thumb, 'thumb');

export const ScrollArea = ({
  children,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof Root>) => (
  <Root orientation={orientation} {...props}>
    <Viewport>
      <Content>{children}</Content>
    </Viewport>
    <ScrollBar orientation={orientation}>
      <Thumb />
    </ScrollBar>
    <Corner />
  </Root>
);
```

### Slot-component file conventions

Models: `scroll-area/` and `tooltip/` (Base UI + slot recipe), `alert-dialog/` (Radix, pending migration).

- **Import naming.** Base UI namespace imports use `Base*` — `import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'`. Never `*Primitive`; that suffix is Radix/Shadcn (`ScrollAreaPrimitive`, `AlertDialogPrimitive`).
- **Slots** = every part the headless primitive exposes in its documented anatomy, plus `root`. Don't invent slots the primitive never had; don't omit parts it requires in the tree (Base UI `ScrollArea.Content` inside `Viewport` is mandatory — Radix hid an equivalent wrapper inside `Viewport`). `root` is mandatory — bind with `withProvider`, or `withRootProvider` when the root renders no DOM (Radix context-only roots during migration).
- **Structural slots.** Register and bind every anatomy part with `withContext` even when the recipe adds no styles — use `slotName: {}` in `base` (see `scroll-area` `content` and `corner`). The slot still gets a generated class and accepts `css` overrides at call sites; the primitive may apply its own inline defaults (e.g. Base UI `Content`'s `minWidth: fit-content`).
- **Recipe-only variants.** Variants that style slots but aren't props on the headless root go on the `withProvider` root — `createStyleContext` consumes them for styling without forwarding to the primitive. Example: `orientation` on `ScrollArea`'s `Root` drives scrollbar slot styles; Base UI takes `orientation` on `Scrollbar`, not `Root`.
- **Bind every rendered slot** with `withContext`, and **compose with the bound slots** — a `Content` that needs a portal renders `<Portal>`, never the raw Base UI portal outside styled wrappers.
- **Portal is internal by default.** A composed `Content` includes the `Portal` (portal-by-default, like Base UI), so bind `Portal` as a non-exported `const` and render it inside `Content`. Don't export it — an exported `Portal` lets a consumer double-wrap (`<X.Portal><X.Content/></X.Portal>`) into nested portals. Export `Portal` only for the manual-composition pattern where `Content` is a bare slot and the consumer writes `<Portal><Overlay/><Content/></Portal>` themselves (e.g. `alert-dialog`).
- **Composed vs part exports.** When the app always uses the full tree, export one composed component (`ScrollArea`). When consumers assemble parts (`Tooltip.Root`, `Tooltip.Trigger`, `Tooltip.Content`), export the bound parts. Keep internal styled slots (`StyledPositioner`, `StyledPopup`) unexported when a composed wrapper owns them.
- **No blanket `data-slot`.** Target a subcomponent via its generated `.rcr-<recipe>__<slot>` class (the recipe `className` is unprefixed; the selector carries the `rcr-` prefix). Add a `data-slot` only where something genuinely needs that hook.
- **`unstyled` prop** drops a slot's recipe styles so you can restyle it via `css` in a specific composition.
- **Shared style chunks** → a module-scope `css.raw({ ... })` const, composed at each slot with `css.raw(chunk, { ...slotSpecific })`. Never object-spread (`{ ...chunk, ...local }`) or `as const`.
- **One slot for identical-styled primitives.** If two primitives carry identical, never-diverging slot styles (e.g. a select's scroll-up vs scroll-down buttons), bind both to a single slot (`withContext(ScrollUpButton, 'scrollButton')` + `withContext(ScrollDownButton, 'scrollButton')`) rather than defining two slots that share a copied chunk. Duplicating a chunk across slots that are never independently overridden is a smell — collapse to one slot; split only when they genuinely differ.
- **Naming:** a slot wrapped by a composed component is the internal `Styled<Slot>` (not exported); its public composed function takes the plain name. Directly-used slots are plain exported consts. Keep it uniform within the file.

### When to reach for a recipe

- Reused across the app → recipe in the component folder, registered in `panda.config.ts`.
- One-off page-local multi-slot component → inline `sva()` from `@/styled-system/css`, optionally with `createStyleContext`.
- One-off single-element → `css` prop on a `styled.*` element. No recipe needed.

## Base UI primitives

- Import from `@base-ui/react/<component>` (e.g. `@base-ui/react/button`, `@base-ui/react/scroll-area`) or the barrel `from '@base-ui/react'`.
- **Namespace alias is `Base*`, not `*Primitive`.** `import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'`. Reserve `*Primitive` for legacy Radix imports only.
- **Base UI uses `render={<Element />}` for composition** — the equivalent of Radix's `asChild`. Pass an element instance, not `asChild` + children.

  ```tsx
  <Button variant="soft" render={<Link to="/records">Records</Link>} />
  ```

- When migrating a Radix component, read the Base UI docs for the equivalent anatomy — don't assume API parity. Common differences:
  - Radix `Content` ≈ Base UI `Popup` (dialog, tooltip, …).
  - Base UI may expose parts Radix hid internally (e.g. `ScrollArea.Content` inside `Viewport`; Radix injected an inner wrapper automatically).
  - Part names shorten under the namespace (`Scrollbar`, `Thumb`, `Corner` — not `ScrollAreaScrollbar`).
- A few utility primitives still live in `radix-ui` today (`@radix-ui/react-slot` for `Slot`, `@radix-ui/colors` for the color scales). Keep those; the migration target is the interactive primitives.

## Icons

- Lucide icons, imported with the `Icon` suffix: `import { HomeIcon } from 'lucide-react'` — not `Home`.
- **Never set the `size` prop on a Lucide icon, and almost never style an icon directly.** An icon should be styled by its PARENT via `_childIcon` — it should not carry its own `className`/`css`. Control size/color via:
  - `_childIcon` on the parent container, `styled()` component, or recipe (`_childIcon: { boxSize: '4' }`) — the default, strongly preferred.
  - A direct `css={{ boxSize: '4' }}` on the icon ONLY as a last resort, when there is genuinely no parent-based way to target it.
- Icons inherit `color: currentColor` and `boxSize: '1em'` from `globals.ts` by default — they scale with surrounding text. Only override when you need something different.
- Use `<Spinner />` from `@/components/spinner` for loading states.

## Forms

- TanStack Form (`@tanstack/react-form`) + Zod v4 for validation. Client hooks via `@/app/trpc.ts`.
- Co-locate the Zod schema with the form component; derive types from the schema.
- The tRPC client's toast link handles mutation errors globally. **Don't add `toast.error(...)` in `onError`** — it's already wired up.
- Remember React Compiler is on — don't manually `useMemo`/`useCallback` field renderers for perf.

## Animations

- **Prefer CSS/Panda animations** via `animateIn`/`animateOut` + modifiers and the `enter`/`exit` keyframes. See `dialog.tsx` and `hover-card.tsx` for entry/exit patterns.
- **`motion/react`** (the Framer Motion successor) for genuinely complex cases — `AnimatePresence`, layout animations, gesture/drag. Import from `motion/react`, not `framer-motion`.
- Animations must be purposeful and GPU-safe (`transform`, `opacity`). Respect reduced-motion preferences.

### Easing and duration tokens

Easing curves follow Emil Kowalski's "Easing Blueprint" and are registered as Panda tokens. Within each family, intensity goes `quad → cubic → quart → quint → expo → circ` (weakest to strongest acceleration).

| Family      | Tokens                                                           | Use for                                                                                                                           |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `easeOut`   | `easeOut.quad`, `.cubic`, `.quart`, `.quint`, `.expo`, `.circ`   | Elements entering or exiting the viewport (dropdowns, modals, toasts). Fast start feels responsive; gentle landing feels natural. |
| `easeInOut` | `easeInOut.quad`, `.cubic`, `.quart`, `.quint`, `.expo`, `.circ` | Elements already on screen that move or morph in place (toggles, expanding panels, sidebars).                                     |
| `linear`    | `linear`                                                         | Constant-rate loops like spinners.                                                                                                |

Typical defaults: `easeOut.cubic` for medium overlays (popovers, dialogs), `easeOut.quad` for small UI (tooltips, switches), `easeOut.quint` for large motion (drawers, sidebars). Existing recipes (`alert-dialog.recipe.ts`, `textarea.recipe.ts`) show the pattern.

**Never use `ease-in` as a family.** It feels sluggish as an entrance — if you reach for it, you almost always want `easeInOut` instead.

Durations are raw ms tokens: `durations.0`, `50`, `100`, `150`, `200`, `250`, `300`, `350`, `400`, `500`. Pick a cadence that scales with element size — ~150ms for tooltips, ~250ms for popovers/dialogs, ~350ms for drawers.

**Never use the `transition` shorthand.** Always spell out the three longhands so each value is explicit and tokenized:

```ts
transitionProperty: '[opacity, transform]',
transitionDuration: '250',
transitionTimingFunction: 'easeOut.cubic',
```

`transitionProperty` usually needs a bracket literal (`'[opacity]'`, `'[color, box-shadow]'`) — only `common`, `colors`, `size`, `position`, `background` are predefined values. `transitionDuration` and `transitionTimingFunction` take tokens (no escape). When a Tailwind `transition-*` class carries no explicit duration/easing, default to `'150'` + `'easeOut.cubic'` unless the element's size/role calls for another curve.

Curves, tokens, and the helpers that build them (`easingCurves`, `curveToCSS`, `getEasing`) all live in `src/app/styles/animations.ts`.

## Event handlers

- No inline arrow functions in JSX `onClick` / `onChange` / etc. Extract to a named handler or a child component with its own handler. This keeps renders cheap and diffs readable.

## Commands

- `bun check` — lint + typecheck + format (runs `oxlint`, `tsgo`, `oxfmt`). Run after every non-trivial change.
- `bun run stylegen` — regenerate `src/app/styled-system/*` after touching recipes, tokens, or `panda.config.ts`.
- `bun run dev` runs both `panda --watch` and Vite; the user starts the dev server manually — don't launch it.
