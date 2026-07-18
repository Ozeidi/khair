---
name: Ethos Charity System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3f4944'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6f7974'
  outline-variant: '#bfc9c2'
  surface-tint: '#226a53'
  primary: '#004331'
  on-primary: '#ffffff'
  primary-container: '#0d5c46'
  on-primary-container: '#8cd2b6'
  inverse-primary: '#8ed5b9'
  secondary: '#455f88'
  on-secondary: '#ffffff'
  secondary-container: '#b6d0ff'
  on-secondary-container: '#3f5882'
  tertiary: '#004325'
  on-tertiary: '#ffffff'
  tertiary-container: '#005d36'
  on-tertiary-container: '#71d79a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#aaf1d4'
  primary-fixed-dim: '#8ed5b9'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#00513d'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#adc7f7'
  on-secondary-fixed: '#001b3c'
  on-secondary-fixed-variant: '#2d476f'
  tertiary-fixed: '#91f8b8'
  tertiary-fixed-dim: '#74db9d'
  on-tertiary-fixed: '#002110'
  on-tertiary-fixed-variant: '#00522f'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  status-draft: '#64748B'
  status-pending: '#F59E0B'
  status-approved: '#10B981'
  status-rejected: '#EF4444'
  status-returned: '#8B5CF6'
  status-completed: '#0D5C46'
  status-delayed: '#B91C1C'
  transparency-private: '#E2E8F0'
typography:
  display-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  code-ref:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The brand personality is **Transparent, Trustworthy, and Methodical**. This design system bridges the gap between the warmth of a community-driven charity and the rigorous precision of a financial institution. It is designed to evoke a sense of "Impactful Accountability"—where donors feel the emotional connection to a cause while having total confidence in the data.

The visual style is **Corporate Minimalism**. It leverages heavy whitespace, a structured grid, and a focus on clarity to ensure that complex financial data is easily digestible. The interface prioritizes the "Transaction-to-Record" relationship, using a clean, uncluttered layout to highlight transparency and auditability. Every element is optimized for **RTL (Right-to-Left)** readability, ensuring a natural and professional flow for Arabic-speaking users.

## Colors

The palette is rooted in **Forest Green (Primary)** to represent growth and life, and **Navy Blue (Secondary)** to symbolize institutional trust. 

- **Primary (#0D5C46):** Used for main actions, brand elements, and representing "Financial Health."
- **Secondary (#1A365D):** Used for navigation, headers, and text elements where authority and stability are required.
- **Tertiary (#38A169):** A brighter green for positive progress bars, "Contribute Now" accents, and success indicators.
- **Neutral (#F8FAFC):** A crisp, cool-toned white background to maintain a "clean" and professional workspace.

Named colors are strictly reserved for system states. These are mapped to specific financial statuses to ensure users can scan a list and immediately understand the health of a project or payment without reading the text label.

## Typography

The typography system uses a dual-font approach optimized for Arabic and English legibility. For Arabic headlines, we utilize a professional, modern sans-serif style that maintains clarity at large sizes.

- **Headlines & Labels:** Use a structured font to provide an authoritative feel.
- **Body Text:** Uses a slightly more "open" and friendly sans-serif to ensure long descriptions of projects are comfortable to read.
- **Code/Ref:** A monospaced font is used exclusively for ID patterns (e.g., `PRJ-2026-0001`) and financial reference codes, distinguishing technical data from narrative content.
- **RTL Logic:** Line heights are slightly increased (1.5x - 1.6x) for Arabic script to prevent diacritics from overlapping.

## Layout & Spacing

The design system employs a **12-column Fixed Grid** for desktop and a **Fluid Single-Column** layout for mobile. 

- **Dashboard Layout:** A permanent sidebar (280px) on the right (for RTL) provides navigation, while the main content occupies the remaining fluid area.
- **Spacing Rhythm:** Based on a 4px baseline. Components utilize 16px (md) or 24px (lg) internal padding to maintain a feeling of openness.
- **Reflow Rules:** On mobile, side-by-side data cards stack vertically. Financial tables transition into "Data Cards" on screens smaller than 768px to preserve readability without horizontal scrolling.
- **Alignment:** Everything is strictly right-aligned. All icons must be mirrored (e.g., arrows) to match the RTL directional flow.

## Elevation & Depth

To maintain a "Professional & Reliable" atmosphere, elevation is used sparingly to define hierarchy rather than for decoration.

- **Tonal Layers:** The primary background uses the neutral slate-white. Surfaces (cards, whiteboards) are pure white. This subtle contrast defines the workspace.
- **Ambient Shadows:** We use ultra-soft, low-opacity shadows (Blur 12px, Y 4px, Opacity 4%) for Project Cards and Modals. This makes the elements feel like they are resting lightly on the surface.
- **Low-Contrast Outlines:** Instead of shadows, internal UI elements like input fields and data dividers use 1px borders in a soft gray (#E2E8F0) to maintain a crisp, "paper-like" financial record aesthetic.
- **Transparency Toggles:** Data points marked as "Private" or "Internal" are given a subtle hatched background pattern or a 50% opacity treatment to visually distinguish them from public-facing data.

## Shapes

The shape language is **Soft and Precise**. 

- **Radius:** A standard radius of 0.25rem (4px) is used for most UI components (inputs, small buttons) to maintain a modern but serious corporate feel. 
- **Large Components:** Project cards and modals use a slightly larger radius (0.5rem) to feel approachable.
- **Progress Bars:** These are the only elements that may use a "Pill" shape (fully rounded) to indicate a fluid, moving status of execution or funding.
- **RTL Considerations:** Border-radius must be applied symmetrically or correctly swapped for RTL (e.g., `rounded-re` becomes `rounded-rs`).

## Components

- **Buttons:** 
    - *Primary:* Solid Forest Green, right-aligned icon.
    - *Secondary:* Navy Blue outline.
    - *Contribute:* Tertiary Green with a slight "pulse" or distinct elevation to draw attention.
- **Project Cards:** Must include a high-quality cover image (top), a dual progress bar (Financial vs. Execution), and a "Share" icon (left-aligned in RTL).
- **Progress Bars:** Use a two-tone system. Background is a light gray; the fill is Primary Green (Financial) or Secondary Blue (Execution).
- **Status Badges:** Compact labels with a subtle background tint and bold text color (using the `named_colors` map).
- **Input Fields:** Clean, outlined boxes with floating labels in Arabic. Error states are highlighted with `status-rejected`.
- **Transparency Toggles:** A stylized "eye" icon next to data points. A slashed eye indicates the data is private.
- **QR Codes:** Presented in a clean white container with a 1px border and the charity's logo in the center for receipt verification.
- **Data Tables:** High-density, with alternating row stripes and fixed headers for audit logs and financial reconciliations.