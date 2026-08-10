---
name: Cyber-Protocol
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e3fdff'
  on-primary: '#00373a'
  primary-container: '#00f3ff'
  on-primary-container: '#006b71'
  inverse-primary: '#00696f'
  secondary: '#ffabf3'
  on-secondary: '#5b005b'
  secondary-container: '#fe00fe'
  on-secondary-container: '#500050'
  tertiary: '#ecffd0'
  on-tertiary: '#1e3700'
  tertiary-container: '#96f400'
  on-tertiary-container: '#3f6b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#ffd7f5'
  secondary-fixed-dim: '#ffabf3'
  on-secondary-fixed: '#380038'
  on-secondary-fixed-variant: '#810081'
  tertiary-fixed: '#9bfc00'
  tertiary-fixed-dim: '#87dd00'
  on-tertiary-fixed: '#0f2000'
  on-tertiary-fixed-variant: '#2e4f00'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  stat-value:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  grid-size: 32px
---

## Brand & Style
The design system is rooted in a **Tech-Noir / Cyberpunk** aesthetic, transforming a standard productivity or gaming app into a high-stakes "Agent Protocol" interface. The brand personality is clinical yet energetic, professional yet rebellious. It targets power users who value immersion and "gamified" progression.

The visual style is a hybrid of **Brutalism** and **Glassmorphism**. It utilizes heavy structural lines and grid-based layouts (Brutalism) while layering content through frosted, translucent panels with neon edge-lighting (Glassmorphism). The UI should evoke the feeling of a heads-up display (HUD) found in near-future hardware.

## Colors
This design system operates exclusively in a **dark mode** environment to maximize the "glow" of neon accents. 

- **Primary (Cyan #00F3FF):** Used for primary actions, active states, and HUD data.
- **Secondary (Magenta #FF00FF):** Reserved for high-priority alerts, legendary items, or decorative accents.
- **Tertiary (Lime #9DFF00):** Specific to "System Green" functions: success states, XP gains, and health/stamina bars.
- **Neutral (Black/Grey):** The base is a deep, near-black (#0D0D0F) with slightly lighter surfaces (#16161A) for depth.

Apply **Neon Outer Glows** to primary elements using a 0.2 opacity spread of the parent color to simulate light emission.

## Typography
The typography strategy mixes technical precision with bold geometry. 

1. **Headlines:** Use **Space Grotesk** for its technical, slightly futuristic flair. High-impact titles should utilize a "glitch" effect (small horizontal offsets of red/cyan channels) on hover or entrance animations.
2. **Body & Stats:** Use **JetBrains Mono**. The monospaced nature reinforces the feeling of reading raw system data and ensures stats (like XP or timers) don't jump when numbers change.
3. **Labels:** Use **Geist** for secondary meta-data and navigation. 

All labels should be uppercase with wide letter-spacing to mimic military or industrial marking.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strict 4px baseline. 

- **The Grid:** A subtle background grid (1px lines, #FFFFFF at 0.03 opacity) must be visible at all times, aligned to the 32px `grid-size`.
- **Safe Zones:** Content is housed in "Modules" that snap to grid intersections. 
- **Desktop:** 12-column layout. Sidebar is fixed at 280px to behave like a permanent hardware control panel.
- **Mobile:** 4-column layout. The sidebar collapses into a bottom "Comms Bar" or a full-screen overlay with glitch transitions.
- **Gutters:** Maintain a wide 24px gutter to give "breathing room" between high-intensity neon panels.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Glassmorphism** rather than traditional soft shadows.

1. **Backdrop Blurs:** Every modal or overlay must use a `backdrop-filter: blur(12px)` with a semi-transparent surface (#16161A at 0.8 opacity).
2. **Inner Glows:** Instead of drop shadows, use 1px inner borders that are slightly brighter than the surface color to define the "lip" of a panel.
3. **Layering:** 
   - Level 0: Background Grid.
   - Level 1: Main Content Panels (Frosted glass).
   - Level 2: Interactive elements (Buttons, Inputs).
   - Level 3: Overlays and Floating HUD elements (Neon glowing borders).

## Shapes
This system uses **Sharp (0)** roundedness. Every corner must be a perfect 90-degree angle to reinforce the "Industrial/Military Tech" aesthetic.

To add visual interest without rounding:
- Use **Angled Cuts:** 45-degree chamfered corners on primary buttons and quest cards.
- **Segmented Borders:** Instead of a continuous border, use "corner brackets" that only frame the four corners of a container.

## Components
- **Buttons:** Primary buttons feature a solid Cyan fill with black text. On hover, the background should "glitch" or flicker. Secondary buttons use a transparent background with a 1px Cyan border and a subtle outer glow.
- **XP & Progress Bars:** Use the Tertiary Lime color. The bar background should be a dark, recessed track. The fill should have a "scanning" animation (a lighter lime highlight moving across the fill).
- **Quest Cards:** These are the primary data containers. They feature a chamfered top-right corner. Use a high-contrast label for "Difficulty" (e.g., [LEVEL: HARD]) in a boxed-mono style.
- **Inputs:** Simple underline style or fully enclosed boxes with 1px borders. When focused, the border glows Cyan and the label "glitches" into view.
- **Chips/Badges:** Small, monospaced text blocks with solid background fills (Magenta for high-tier, Cyan for standard).
- **HUD Stats:** Tabular-numeric stats displayed in large Space Grotesk weights, often accompanied by a small "Delta" indicator (e.g., +150 XP) in the Tertiary color.