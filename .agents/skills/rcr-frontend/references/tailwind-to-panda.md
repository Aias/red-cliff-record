# Tailwind to Panda migration

Use this reference when translating legacy Tailwind in `src/app/` — `className` strings, `cn(...)` calls, `c-*` color aliases, `@utility` rules, Radix primitives — into Panda. The main `SKILL.md` documents authoring conventions for new Panda code; this document covers the translation patterns and project-specific mappings that come up during the migration.

## Color tokens — the `c-*` aliases

Tailwind uses `c-*` color aliases (e.g. `text-c-hint`, `bg-c-paper`) that resolve to CSS variables defined in `src/app/styles/theme.css`. Not every alias has a direct Panda semantic token. This table is the project decision on where to point each one.

| Tailwind alias | Panda equivalent | Notes |
| --- | --- | --- |
| `c-display` | `display` | |
| `c-primary` | `primary` | |
| `c-secondary` | `secondary` | |
| `c-muted` | `muted` | |
| `c-symbol` | `symbol` | |
| `c-accent` | `accent` | Through the active `colorPalette`. |
| `c-hint` | `muted` | `hint` is not a Panda semantic token; `muted` is the nearest equivalent. One step bolder than the CSS variable `--hint`; accept the shift. |
| `c-destructive` | `colorPalette: 'error'` + `color: 'accent'` | The `c-destructive` alias was never defined in `theme.css`; it was a dead reference in legacy code. For error text, use the palette pattern in the next section. |
| `c-background` | `background` | |
| `c-paper` | `surface` | Both resolve to `light-dark({neu.1}, {neu.2})`. |
| `c-container` | `container` | |
| `c-float` | `float` | |
| `c-divider` / `c-border` / `c-edge` | `divider` / `border` / `edge` | Also available as the `borders` tokens `divider` / `border` / `edge` for `borderInlineEnd`, etc. |
| `c-ring` | `focus` | Same underlying `--clr-9` step. |
| `c-mist` / `c-splash` / `c-flood` | `mist` / `splash` / `flood` | |
| `c-main` / `c-main-active` / `c-main-contrast` | `main` / `mainActive` / `mainContrast` | |

## Radius — no mental gymnastics needed

Tailwind's default `rounded-*` scale is offset one step from this project's Panda radii. The project overrides the Tailwind theme (`src/app/styles/app.css` — `@theme { --radius-sm: 2px; --radius-md: 4px; ... }`) so the two scales line up 1:1:

| Tailwind class | Panda token | Value |
| --- | --- | --- |
| `rounded-sm` | `sm` | 2px |
| `rounded-md` | `md` | 4px |
| `rounded-lg` | `lg` | 8px |
| `rounded-xl` | `xl` | 12px |

One trap: bare `rounded` (no suffix) in Tailwind v4 is `0.25rem` unless explicitly overridden — that's 4px, which matches Panda `md`, not `sm`. Don't instinctively map `rounded` to `sm`.

## Sizes — Tailwind `max-w-*` maps to the numeric scale

The `spacing` and `sizes` token scales in `src/app/styles/dimensions.ts` are multiples of `0.25rem`. Tailwind's named max-width keywords translate to specific numeric tokens:

| Tailwind | Value | Panda numeric token |
| --- | --- | --- |
| `max-w-sm` | 24rem | `96` |
| `max-w-md` | 28rem | `112` |
| `max-w-lg` | 32rem | `128` |
| `max-w-xl` | 36rem | `144` |
| `max-w-2xl` | 42rem | `168` (add if needed) |
| `max-w-3xl` | 48rem | `192` |
| `max-w-4xl` | 56rem | `224` |
| `max-w-5xl` | 64rem | `256` |
| `max-w-6xl` | 72rem | `288` |
| `max-w-7xl` | 80rem | `320` |

Also: `screenW` = `100dvw`, `screenH` = `100dvh`, `auto` = `auto`, `prose` = `65ch`. Prefer these tokens over bracket literals (`[100vw]`, `[65ch]`).

For off-scale values (e.g. `max-w-166`), pick the closest token rather than a bracket literal. If the same off-scale value recurs in multiple places, extend `SHARED_DIMENSIONS` in `dimensions.ts` and regenerate with `bun run stylegen`.

## `colorPalette` + `layerStyle` — apply at the common ancestor

Setting `colorPalette: 'error'` (or `success` / `info`) without also setting `layerStyle` resolves through the *neutral* half of the palette pair — for `error`, that's mauve, not tomato. The chromatic treatment requires both:

```tsx
<styled.div css={{ colorPalette: 'error', layerStyle: 'chromatic' }}>
  <styled.h3 css={{ color: 'accent' }}>Record not found</styled.h3>
  <styled.p css={{ color: 'muted' }}>This record may have been deleted.</styled.p>
</styled.div>
```

The palette + layerStyle pair goes on the highest common ancestor for the error surface, so every descendant (both the accent heading *and* the muted body text) resolves through the error palette. Inner elements don't repeat the palette — they just use semantic color names.

Inside a recipe, gate the palette swap on a variant or condition — e.g. `_invalid: { colorPalette: 'error' }` on input states. See `components/field/textarea.recipe.ts` and `components/button/button.recipe.ts` for the pattern.

## Dynamic styles — data attributes, not template-literal classes

Panda extracts styles statically, so dynamic className toggles (`` className={`foo ${condition ? 'bar' : ''}`} ``) don't reliably generate CSS. Use data attributes as the conditional switch and target them from the `css` object:

```tsx
<styled.main
  data-record-selected={isRecordSelected || undefined}
  css={{
    padding: '3',
    '&[data-record-selected]': { padding: '0' },
  }}
>
```

This keeps the style object fully static while letting runtime state flip which rule applies. Write the attribute value as `condition || undefined` so the attribute is absent when false — otherwise `data-foo="false"` still matches `[data-foo]`.

For dynamic numeric values (e.g. computed widths), use the inline `style` attribute — Panda can't tokenize those at build time anyway.

## Recipe scope — self-contained components

The base styles of a recipe should be the component's *intrinsic* appearance — things that are true no matter where you drop it on the page. Anything that depends on the parent layout (`flexShrink`, `_last: { marginBlockEnd }`, positioning in a grid) is the consumer's concern and should live in the consumer's `css` prop:

```tsx
// Shared recipe: base says nothing about flex context or siblings
export const Card = styled('div', {
  base: { display: 'block', overflow: 'hidden', borderRadius: 'md', ... },
  variants: { compact: { true: {...}, false: {...} } },
});

// Consumer: layout-specific rules on the css prop
<Card as="li" compact={!node.isStructural} css={{ flexShrink: '0', _last: { marginBlockEnd: '8' }}}>
```

Margin on a shared component is almost always an antipattern — a component shouldn't "know" that it sits in a list or that its last sibling needs extra space. The exception is a slot recipe: internal slots *are* part of the component's own anatomy, so a slot recipe can absolutely apply margin/positioning rules that relate one slot to another (e.g. the spacing between a `Dialog`'s header and body). The test is whether the rule references something inside the component (a sibling slot) or outside it (a parent list, a page layout).

## Single-element recipes vs slot recipes

Reach for `sva()` or `defineSlotRecipe` only when there are genuinely multiple slots with related styling — e.g. a dialog with overlay/content/title/close, a table with root/row/cell. A single-element component with variants (Card, Badge, Button at its simplest) is a config recipe, not a slot recipe:

```tsx
export const Card = styled('div', {
  base: { ... },
  variants: { compact: { true: {...}, false: {...} } },
  defaultVariants: { compact: false },
});

// Consumer can swap the element with `as`
<Card as="li" compact>...</Card>
<Card as="article">...</Card>
```

Using `sva` with a single `root` slot works but is strictly more machinery than needed — prefer `styled('div', {...})`.

## Bracket literals — try without first

Panda's strict types will tell you whether a value is acceptable without an escape hatch. Always try the value directly first; only reach for brackets when TypeScript rejects it.

Values that look arbitrary but usually work as-is:

- `aspectRatio: '3/2'` — CSS accepts ratios directly.
- `outlineWidth: '2px'` — pixel strings are valid outline widths.
- `flex: '1'`, `flexBasis: 'auto'` — strings that match CSS values.
- `opacity: '75%'` — percent strings.

Values that genuinely need the bracket (or a real token):

- `textShadow`, `boxShadow` — strict shadow types; use the bracket with token interpolation: `textShadow: '[0 0 4px {colors.black}]'`.
- `backgroundImage` gradients — no gradient tokens, use `[linear-gradient(...)]`.
- Viewport calcs, off-scale pixels, runtime math — `[calc({sizes.screenW} - 1rem)]`, `[75vh]`.
- Custom `gridTemplateColumns` — `[repeat(auto-fill, minmax(min(100%, 12rem), 1fr))]`.

Read the type error to decide: `"expects SpacingToken"` means the scale is the spacing scale; `"expects SizeToken"` means sizes; `"expects ShadowToken"` means there's no way to express this without the bracket or a shadow token.

## Color literals — prefer `oklch()`

The project's color system is built on `oklch`. New color literals should match:

```tsx
// Good
textShadow: '[0 0 4px {colors.black}]'
backgroundImage: '[linear-gradient(to top, oklch(0 0 0 / 0.8), transparent)]'

// Avoid
textShadow: '[0 0 4px rgba(0, 0, 0, 1)]'
backgroundImage: '[linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)]'
```

Use `{colors.black}` / `{colors.white}` token interpolation wherever possible; fall back to raw `oklch(...)` only for alpha-mixed literals.

## Global `@utility` cleanup

When a Tailwind `@utility foo { … }` has a single consumer, don't leave it lying around. Inline the styles in the consumer (or promote to a Panda recipe under `components/` if it's genuinely shared) and delete the `@utility` rule. Same for now-unused class-based globals in `styles/globals.ts` — if the `.root` or `.card` selector has no users left, remove it.

Before deleting: `Grep` for the utility name across `src/` and `.css` files to confirm no remaining consumers.

## Shared components still in Tailwind

Most `src/app/components/*` are still authored with `className` + `cn()` internally and haven't been migrated. When a call site needs to pass styles to one of them, don't wait for the migration — use `className={css({...})}`:

```tsx
<PopoverContent className={css({ width: '160', overflow: 'auto', padding: '0' })}>
<CommandList className={css({ maxHeight: '[75vh]' })}>
```

If the component is already a `styled()` component (check `components/spinner.tsx`, `components/placeholder.tsx`), use the `css` prop directly instead:

```tsx
<Spinner css={{ boxSize: '4' }} />
<Placeholder css={{ flexGrow: '1' }}>...</Placeholder>
```

## TanStack `<Link>` and other non-Panda elements

TanStack Router's `<Link>` is a plain component that accepts `className` — not a Panda `styled()` or Base UI primitive. Use `className={css({...})}`:

```tsx
<Link to="/records" className={css({ textStyle: 'sm' })}>Index</Link>
```

Don't confuse this with Base UI's `render` prop, which is for composing a Base UI primitive's behavior onto a different rendered element (e.g. `<Button render={<Link to="/" />} />`). Different pattern, different intent.

## `sr-only`, `srOnly`, and container-query visibility

Replace `className="sr-only"` with `css={{ srOnly: true }}` (the Panda utility, defined in `styles/plugins.ts`). For visibility controlled by a container query:

```tsx
<SearchIcon
  className={css({ '@container (max-width: 10rem)': { srOnly: true } })}
/>
```

The container query targets the nearest ancestor with `containerType` set. Establish a container context on the scoping ancestor with `containerType: 'inline-size'`.

## Selector hooks inside a `css` block

When a parent recipe or `css` object needs to target a specific descendant, use `data-slot="..."` attributes rather than a bare className. It matches Base UI's convention and avoids colliding with utility classes:

```tsx
<LinkButton
  css={{
    '& [data-slot="label"]': {
      srOnly: true,
      '@/sm': { srOnly: false },
    },
  }}
>
  <Icon />
  <span data-slot="label">Red Cliff Record</span>
</LinkButton>
```
