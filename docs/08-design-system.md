# 08 — Design System

Reference for colors, typography, spacing, components.

All tokens live in [`assets/css/tokens.css`](../assets/css/tokens.css). Change a token there → entire site updates.

---

## Colors

### Surface
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0a0a0c` | Page background |
| `--bg-deep` | `#050507` | Deepest surface (reader bg) |
| `--surface-1` | `#111114` | Cards, panels |
| `--surface-2` | `#16161b` | Inputs, raised surfaces |
| `--surface-3` | `#1c1c22` | Hover, active states |
| `--border` | `#1f1f26` | Default borders |
| `--border-soft` | `#15151a` | Subtle dividers |
| `--border-bold` | `#2a2a33` | Highlighted borders |

### Text
| Token | Hex | Usage |
|---|---|---|
| `--text` | `#ececf3` | Primary |
| `--text-soft` | `#b4b4c0` | Secondary |
| `--text-muted` | `#74747f` | Tertiary, captions |
| `--text-faint` | `#4a4a55` | Disabled |

### Brand
| Token | Hex | Usage |
|---|---|---|
| `--accent` | `#f0b941` | Primary brand gold. CTAs, highlights, links. |
| `--accent-2` | `#e84545` | Secondary red. Alerts, NEW badges. |
| `--success` | `#4ade80` | Ongoing status, success toasts |
| `--info` | `#60a5fa` | Completed status, info toasts |
| `--warning` | `#fbbf24` | Hiatus status |
| `--danger` | `#ef4444` | Delete buttons, errors |

---

## Typography

### Fonts
- **Display** (`--font-display`): `Syne` — bold, geometric. Used for headings and titles.
- **Body** (`--font-body`): `Inter` — clean sans-serif. Used for everything else.
- **Mono** (`--font-mono`): `JetBrains Mono` — for codes/IDs only.

Loaded from Google Fonts. Preconnect headers added for perf.

### Type scale
Modular, mobile-first. Breakpoints bump headings.

| Token | px (base) | px (≥768) | Usage |
|---|---|---|---|
| `--fs-xs` | 12 | 12 | Captions, timestamps |
| `--fs-sm` | 14 | 14 | Body small |
| `--fs-base` | 16 | 16 | Body |
| `--fs-md` | 18 | 18 | Lead text |
| `--fs-lg` | 20 | 20 | h4 |
| `--fs-xl` | 24 | 24 | h3, section title |
| `--fs-2xl` | 30 | 36 | h2 |
| `--fs-3xl` | 36 | 48 | h1 |

### Weights
| Token | Value |
|---|---|
| `--fw-light` | 300 |
| `--fw-regular` | 400 |
| `--fw-medium` | 500 |
| `--fw-semibold` | 600 |
| `--fw-bold` | 700 |
| `--fw-black` | 800 |

---

## Spacing

Strict 4px grid. **Don't invent values outside this scale.**

| Token | px |
|---|---|
| `--s-1` | 4 |
| `--s-2` | 8 |
| `--s-3` | 12 |
| `--s-4` | 16 |
| `--s-5` | 20 |
| `--s-6` | 24 |
| `--s-8` | 32 |
| `--s-10` | 40 |
| `--s-12` | 48 |
| `--s-16` | 64 |
| `--s-20` | 80 |
| `--s-24` | 96 |

---

## Radius

| Token | px | Usage |
|---|---|---|
| `--r-xs` | 4 | Tags, small inputs |
| `--r-sm` | 8 | Buttons, inputs, cards |
| `--r-md` | 12 | Series cards, modals |
| `--r-lg` | 16 | Hero cover, large panels |
| `--r-pill` | 999 | Tag pills, dots |
| `--r-full` | 50% | Avatars, dots |

---

## Shadows

| Token | Use |
|---|---|
| `--sh-sm` | Subtle lift (cards at rest) |
| `--sh-md` | Pressed cards (hover) |
| `--sh-lg` | Drawers, FABs |
| `--sh-xl` | Hero cover, login card |
| `--sh-glow` | Gold accent glow on hover |

---

## Motion

| Token | Duration | Use |
|---|---|---|
| `--t-fast` | 120ms | Hover states |
| `--t-base` | 200ms | Most transitions |
| `--t-slow` | 320ms | Drawer open/close |
| `--t-slower` | 500ms | Hero slide change |

| Easing | Curve | Use |
|---|---|---|
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entering |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting |

> All motion respects `prefers-reduced-motion`. Tokens reduce to `0ms` when user prefers reduced motion.

---

## Glass

Used **only** on navbar + hero. Heavy backdrop-filter on cards crushes mobile FPS.

```css
.glass {
  background: var(--glass-bg);          /* rgba(10,10,12, 0.72) */
  backdrop-filter: var(--glass-blur);   /* blur(16px) saturate(160%) */
  border-bottom: 1px solid var(--glass-border);
}
```

---

## Components

Quick visual reference. Look at `assets/css/components.css` for the source.

### Buttons
| Class | Description |
|---|---|
| `.btn` | Base |
| `.btn-primary` | Gold gradient + glow |
| `.btn-outline` | Transparent w/ border |
| `.btn-ghost` | Transparent, no border |
| `.btn-danger` | Red |
| `.btn-sm`, `.btn-lg` | Size variants |
| `.btn-icon` | Square (40×40), used with svg child |
| `.btn-block` | Full width |

### Cards
| Class | Description |
|---|---|
| `.card-grid` | Auto-fill grid, responsive minmax 140 → 200px |
| `.card` | Series card. Has hover lift + gold border + zoom |
| `.card-img-wrap` | 2/3 aspect ratio container |
| `.card-badge` | Status badge top-left |
| `.card-chapter` | "Ch. N" overlay at bottom |

### Tags
| Class | Description |
|---|---|
| `.tag-pill` | Pill button (used for genres) |
| `.tag-row` | Flex wrap row |
| `.tag-row.scroll` | Horizontal scroll (mobile genre strip) |

### Status badges
- `.badge-ongoing` (green)
- `.badge-completed` (blue)
- `.badge-hiatus` (yellow)
- `.badge-dropped` (gray)
- `.badge-new` (red)
- `.badge-hot` (orange-red gradient)

### Layout
- `.container` (max-width 1280, padding 16/24/32 by breakpoint)
- `.section` (vertical padding by breakpoint)
- `.between`, `.center`, `.row`, `.stack` (flex helpers)
- `.gap-1` through `.gap-8`

### Forms
- `.input`, `.textarea`, `.select` (styled inputs)
- `.field` (label + input wrapper)
- `.field-row` (2-column row, collapses on mobile)
- `.field-label`, `.field-hint`, `.field-error`

### Feedback
- `.toast` (info/success/error variants)
- `.modal-overlay` + `.modal`
- `.drawer` (bottom sheet on mobile, side panel on desktop)
- `.skel` + `.skel-card` + `.skel-line` (loading skeletons)
- `.spinner`, `.spinner-sm`

---

## Responsive breakpoints

| Range | Behavior |
|---|---|
| `<480px` | Single column. Bottom nav active. Tap zones ≥44px. |
| `480–768px` | 2-col grids. Bottom nav. Hamburger menu. |
| `768–1024px` | 3–4 col grids. Top nav appears. |
| `1024–1440px` | 4–6 col grids. Hover states active. Sidebars in admin/browse. |
| `>1440px` | Max content 1280px (don't stretch). |

---

## Accessibility

- Focus ring: 2px solid gold, 2px offset, only on `:focus-visible`.
- Color contrast: all text combinations meet WCAG AA on the dark bg.
- Reduced motion: respected throughout.
- Keyboard nav: works on all interactive elements.
- ARIA labels on icon buttons (search, menu, share, etc.).

---

## When to add a new component

Yes:
- It's reused 2+ times.
- It's a clear visual primitive (e.g. a "pill" for tags is fine).

No:
- One-off page styling — use utility classes or page-specific CSS.
- Tiny variations of an existing component — use modifiers.
