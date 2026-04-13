# LabMate Design System

Design language inherited from the BioinfoSpace main site.

## Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Headings | Bricolage Grotesque | 600-700 | h1-h4, brand, large numbers |
| Body | DM Sans | 400-600 | Text, labels, buttons, nav |
| Code | JetBrains Mono | 400-500 | Inputs, amounts, monospace values |

Variable font: Bricolage Grotesque uses `font-variation-settings: "opsz"` for optical size.

## Color Palette

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `hsl(40, 20%, 99%)` | Page background |
| `--bg-2` | `hsl(170, 20%, 95%)` | Secondary background, input bg |
| `--card` | `hsl(40, 15%, 98%)` | Card background |
| `--primary` | `hsl(161, 69%, 37%)` | Teal accent, active states |
| `--primary-hover` | `hsl(168, 55%, 32%)` | Hover states |
| `--primary-light` | `hsl(170, 20%, 95%)` | Light teal background |
| `--accent` | `hsl(168, 55%, 22%)` | Deep teal for emphasis |
| `--text` | `hsl(200, 25%, 10%)` | Primary text |
| `--text-muted` | `hsl(200, 12%, 44%)` | Secondary text, labels |
| `--border` | `hsl(200, 15%, 90%)` | Borders, dividers |
| `--warning-bg` | `hsl(45, 90%, 94%)` | Amber banners |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `hsl(210, 30%, 6%)` | Page background |
| `--bg-2` | `hsl(210, 20%, 14%)` | Secondary background |
| `--card` | `hsl(210, 25%, 9%)` | Card background |
| `--primary` | `hsl(161, 65%, 48%)` | Brighter teal for contrast |
| `--text` | `hsl(200, 15%, 95%)` | Primary text |
| `--text-muted` | `hsl(200, 12%, 60%)` | Secondary text |

## Gradients

- **Primary**: `linear-gradient(135deg, hsl(168,65%,40%), hsl(180,60%,50%), hsl(195,55%,55%))`
- **Tab indicator**: `linear-gradient(90deg, hsl(161,69%,37%), hsl(165,60%,42%), hsl(175,55%,48%))`

## Component Patterns

### Cards
- Background: `var(--card)`, border: `1px solid var(--border)`
- Border radius: `0.625rem` (`--radius`)
- Hover: `translateY(-2px)` + gradient top border reveal
- Shadow: subtle default, elevated on hover

### Navigation
- Glass morphism: `backdrop-filter: blur(20px) saturate(1.8)`
- Sticky top, z-index 40
- Tab bar with gradient underline indicator

### Inputs
- Font: JetBrains Mono
- Focus: teal ring (`0 0 0 3px hsla(168, 55%, 26%, 0.1)`)
- Border: 1.5px solid, rounds to `calc(var(--radius) - 2px)`

### Filter Pills
- Rounded-full, text-xs, font-semibold
- Active: primary bg + white text
- Inactive: card bg + muted text + border

### Protocol Timeline
- Left border: 1.5px line with dot markers
- Active step dots: teal, 8px
- Sub-steps: smaller 5px dots, indented

### Well Plate
- Circular wells with hover scale(1.08)
- Selected: 2.5px teal outline

## Spacing

Base font size: 15px. Line height: 1.65.
Labels: 0.68rem, uppercase, letter-spacing 0.07em.
Cards: padding varies (mobile: 0.75rem, desktop: per component).

## Animations

- Card entrance: `translateY(10px)` → 0, 0.32s ease
- Toast: slide-in from bottom, auto-dismiss at 3s
- Tab switch: CSS transition on border-bottom-color
- Spin: `rotate(0deg)` → `360deg` for loading/sync indicators
