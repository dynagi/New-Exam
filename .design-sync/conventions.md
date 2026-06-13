# SecureAIExam Design System — tokens only

This is a **tokens-only** design system: colors, spacing, radius, and gradients
extracted from the SecureAIExam mobile app (`mobile/src/lib/theme.ts`). There are
**no components** in this project — the source app is React Native, so its
components don't render as DOM. Build with your own layout/markup, but draw every
color, space, radius, and gradient from the tokens below so designs stay on-brand.

## Setup

Load `styles.css` once at the root. It defines all tokens as CSS custom
properties on `:root`. **Light is the default palette.** For dark, set
`data-theme="dark"` (or class `dark`) on any container — every `--color-*`
remaps underneath it. No provider, no JS.

```html
<!-- light (default) -->
<div style="background: var(--color-bg); color: var(--color-text)"> … </div>

<!-- dark: scope it to a container -->
<div data-theme="dark" style="background: var(--color-bg); color: var(--color-text)"> … </div>
```

## The styling idiom: CSS variables only

No utility classes and no component props — **style with `var(--*)` tokens**.
Never hardcode a hex; reach for the token. The full vocabulary:

| Family | Tokens |
|---|---|
| Surfaces | `--color-bg`, `--color-bg-elevated`, `--color-surface`, `--color-surface-alt`, `--color-border`, `--color-border-light` |
| Text | `--color-text`, `--color-text-dim`, `--color-text-faint` |
| Brand | `--color-primary`, `--color-primary-dark`, `--color-primary-soft`, `--color-accent`, `--color-violet` |
| Status | `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-gold` |
| On-fill / overlay | `--color-on-accent` (text over a fill), `--color-backdrop` (modal scrim), `--color-glass`, `--color-glass-border` |
| Aurora background | `--color-mesh-1`, `--color-mesh-2`, `--color-mesh-3` |
| Spacing | `--space-xs` (4) `--space-sm` (8) `--space-md` (12) `--space-lg` (16) `--space-xl` (24) |
| Radius | `--radius-sm` (10) `--radius-md` (14) `--radius-lg` (18) `--radius-xl` (24) |
| Gradients | `--gradient-primary`, `--gradient-success`, `--gradient-danger`, `--gradient-brand` (ready-to-use 135deg); plus raw `--gradient-*-from/-via/-to` stops |

Notes that match the source app's intent:
- `--color-primary-soft` is a translucent primary for **selected/active backgrounds**.
- The **glass** pair (`--color-glass` + `--color-glass-border`) is the frosted-surface
  look; pair with `backdrop-filter: blur(…)`. `--blur-tint` carries the matching tint hint.
- The brand gradient (`--gradient-brand`) is the cyan→blue→violet brand mark.

## Where the truth lives

`styles.css` and its `@import`s — `tokens/colors.css` (both palettes),
`tokens/scale.css` (spacing + radius), `tokens/gradients.css`. Read those before
styling. `tokens/tokens.json` is the same data machine-readable.

## Build snippet

```html
<div data-theme="dark"
     style="background: var(--color-surface);
            border: 1px solid var(--color-glass-border);
            border-radius: var(--radius-lg);
            padding: var(--space-xl);
            color: var(--color-text);">
  <h3 style="margin: 0 0 var(--space-sm); color: var(--color-text)">Exam sealed</h3>
  <p style="margin: 0 0 var(--space-lg); color: var(--color-text-dim)">Dual custody verified.</p>
  <button style="background: var(--gradient-primary);
                 color: var(--color-on-accent);
                 border: none;
                 border-radius: var(--radius-md);
                 padding: var(--space-sm) var(--space-lg);">
    Continue
  </button>
</div>
```
