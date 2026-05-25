import { useRender } from '@base-ui/react/use-render';

export type PolymorphicDivProps = useRender.ComponentProps<'div'>;

/**
 * A polymorphic `<div>` whose root tag can be overridden via Base UI's `render` prop.
 * Mirrors the `ark.div` / Radix `Slot` pattern but built on `useRender`.
 *
 * Use as the base of `styled(PolymorphicDiv, recipe)` to combine Panda's `css` /
 * recipe pipeline with `render`-based polymorphism on a single root element.
 */
export function PolymorphicDiv({ render, ...props }: PolymorphicDivProps) {
  return useRender({
    defaultTagName: 'div',
    render,
    props,
  });
}
