# Bundle Size Optimization Plan

## Current State Analysis

### Bundle Breakdown

| Chunk               | Size       | Gzip   | Contents                                                |
| ------------------- | ---------- | ------ | ------------------------------------------------------- |
| `main-*.js`         | **983 KB** | 278 KB | Core: React, TanStack, Radix, Lucide, Motion, tRPC, Zod |
| `_recordId-*.js`    | 120 KB     | 36 KB  | Record detail page components                           |
| `toggle-group-*.js` | 45 KB      | 13 KB  | Radix toggle group primitives                           |
| `route-*.js`        | 40 KB      | 12 KB  | Route components                                        |
| Others              | ~15 KB     | ~5 KB  | Small route chunks                                      |

**Total Client JS: ~1.2 MB (347 KB gzipped)**

### Key Issues Identified

1. **No route-level code splitting** - All routes are eagerly imported in `routeTree.gen.ts`
2. **Large main chunk** - 983 KB is nearly 2x the recommended 500 KB limit
3. **Heavy dependencies bundled together:**
   - React + ReactDOM (~140 KB)
   - TanStack Router/Query/Form/Start (~200 KB)
   - Radix UI - 17 primitives (~150 KB)
   - Lucide React - 30 icons (~60 KB)
   - Motion (~80 KB)
   - tRPC (~50 KB)
   - Zod (~50 KB)

### Dependencies in Use

```
55 imports from 'react'
21 imports from 'lucide-react' (30 unique icons)
20 imports from 'radix-ui' (17 unique primitives)
17 imports from '@tanstack/react-router'
11 imports from '@aias/hozo'
6 imports from 'sonner'
5 imports from '@tanstack/react-query'
```

### Radix Primitives Used

AlertDialog, Avatar, Checkbox, Dialog, DropdownMenu, HoverCard, Label, Popover, RadioGroup, ScrollArea, Select, Separator, Slider, Switch, Tabs, Toggle, ToggleGroup, Tooltip

### Route Structure

```
/                    - index.tsx (home page)
/records             - route.tsx (records list)
/records/$recordId   - $recordId.tsx (record detail - largest route)
/integrations        - index.tsx
/api/trpc/$          - API handler
```

The `form.tsx` component in records is 757 lines and imports many heavy dependencies.

---

## Implementation Plan

### Phase 1: Automatic Code Splitting (Highest Impact)

**File to modify:** `vite.config.ts`

Add `autoCodeSplitting: true` to the TanStack Start plugin:

```ts
tanstackStart({
  srcDirectory: './src/app',
  autoCodeSplitting: true,  // Add this
}),
```

This will automatically split route components into lazy-loaded chunks without any route file changes.

**Expected impact:** Should split components out of main chunk, reducing initial load significantly.

### Phase 2: Manual Chunks for Vendor Splitting

**File to modify:** `vite.config.ts`

Add rollup output configuration:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-router': ['@tanstack/react-router', '@tanstack/react-query', '@tanstack/react-form'],
        'vendor-ui': ['radix-ui', 'lucide-react'],
        'vendor-motion': ['motion'],
      }
    }
  }
}
```

**Expected impact:** Better caching - vendor chunks change less frequently than app code.

### Phase 3: Lazy-Load Heavy Components (If Needed)

If automatic splitting isn't enough, manually split heavy components:

1. **Dialogs/Modals** - AlertDialog, Dialog components
2. **Media components** - MediaGrid, MediaLightbox, MediaUpload
3. **Form component** - The 757-line form.tsx

Create `.lazy.tsx` versions:

```ts
// src/app/routes/records/$recordId.lazy.tsx
import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/records/$recordId')({
	component: RecordDetail,
});

function RecordDetail() {
	// ... component code
}
```

### Phase 4: Icon Optimization (Lower Priority)

Options:

1. Use `@iconify/react` for on-demand icon loading
2. Create a barrel file exporting only used icons
3. Consider inline SVGs for most-used icons

---

## Files to Modify

1. `vite.config.ts` - Add autoCodeSplitting and manual chunks
2. `src/app/routes/records/$recordId.tsx` - Split if needed
3. `src/app/routes/records/-components/form.tsx` - Split if needed

## Verification Steps

1. Run `bun run build` and compare chunk sizes
2. Check that routes still work correctly
3. Verify lazy loading in Network tab (chunks load on navigation)
4. Re-run visualizer to confirm improvements

## Success Criteria

- Main chunk under 500 KB
- Route components in separate lazy-loaded chunks
- Vendor libraries in cacheable chunks
- No functionality regressions
