---
name: Shopify Sync Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d8d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'---
name: Shopify Sync Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d8d9e4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ededf8'
  surface-container-high: '#e7e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#424654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#eff0fa'
  outline: '#737785'
  outline-variant: '#c2c6d6'
  surface-tint: '#0058cc'
  primary: '#0045a3'
  on-primary: '#ffffff'
  primary-container: '#005bd3'
  on-primary-container: '#d3deff'
  inverse-primary: '#b0c6ff'
  secondary: '#5d5e64'
  on-secondary: '#ffffff'
  secondary-container: '#dfdfe6'
  on-secondary-container: '#616268'
  tertiary: '#842d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ac3d00'
  on-tertiary-container: '#ffd5c6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00419c'
  secondary-fixed: '#e2e2e9'
  secondary-fixed-dim: '#c6c6cd'
  on-secondary-fixed: '#1a1c20'
  on-secondary-fixed-variant: '#45474c'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
typography:
  h1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  gutter: 20px
---

## Brand & Style

The design system is engineered to evoke **reliability, precision, and seamless integration**. As a synchronization tool for Shopify merchants, the interface must feel like a natural extension of their existing workflow—utilitarian yet refined. 

The visual direction follows a **Corporate / Modern** aesthetic. It prioritizes clarity over decorative elements, utilizing generous whitespace and a structured information hierarchy to reduce the cognitive load associated with data management. The goal is to build immediate trust, ensuring users feel their store data is being handled by a robust, professional-grade engine.

## Colors

The color palette is anchored by a high-energy **Action Blue**, directly inspired by modern e-commerce administrative interfaces to provide instant recognition for interactive elements. 

- **Primary & Actions:** Use the Action Blue (#005BD3) for primary buttons, active states, and critical navigation links.
- **Surface & Background:** The interface utilizes a tiered gray system. The main background is a cool light gray to reduce glare, while primary content containers sit on pure white surfaces to create clear containment.
- **Typography:** Text is set in a Deep Charcoal (#202223) to ensure maximum contrast without the harshness of pure black. Secondary information uses a muted Slate Gray.
- **Semantic States:** Success (Green), Warning (Amber), and Error (Red) colors are calibrated for high visibility against the light background, ensuring system alerts are never missed.

## Typography

This design system utilizes **Inter** for all typographic needs. Chosen for its exceptional legibility in data-dense SaaS environments, Inter provides a tall x-height and distinct character shapes that remain clear even at small sizes in data tables.

Headlines should be kept concise and use a tighter letter-spacing for a grounded, professional look. Body text leverages a standard 14px base for optimal readability in dashboard contexts, while labels utilize a semi-bold weight and subtle tracking to distinguish themselves from interactive elements.

## Layout & Spacing

The layout philosophy is built on a **12-column fixed grid** system for main content areas, ensuring data consistency across different screen resolutions. 

- **Grid:** Use a 1280px max-width container for dashboard views, centered on the viewport.
- **Rhythm:** A base-4 logic governs all spacing. Use 16px (md) for standard padding within cards and 24px (lg) for margins between major sections.
- **Density:** In data-heavy views (like sync logs), vertical spacing may be reduced to 8px (sm) to increase information density without sacrificing clarity.

## Elevation & Depth

To maintain a clean and professional aesthetic, the design system avoids heavy shadows. Instead, it utilizes **low-contrast outlines** and **tonal layering** to indicate depth.

- **Level 0 (Background):** Light gray (#F6F6F7) surface.
- **Level 1 (Cards/Sections):** Pure white surface with a 1px solid border (#E1E3E5). No shadow.
- **Level 2 (Dropdowns/Modals):** Pure white surface with a subtle ambient shadow (0px 4px 12px rgba(0,0,0,0.08)) and a light border to distinguish the element from the background content.
- **Interaction:** Hover states on interactive cards should transition from a static border to a slightly darker border color rather than increasing shadow depth.

## Shapes

The design system adopts a **Soft (Level 1)** roundedness profile. This 4px (0.25rem) base radius provides a modern touch while maintaining a disciplined, structured feel appropriate for a business tool.

- **Standard Elements:** Buttons, input fields, and checkboxes use the base 4px radius.
- **Containers:** Large cards and informational banners use an 8px (rounded-lg) radius to soften the overall interface.
- **Form Elements:** Maintain strict 4px corners to communicate precision in data entry.

## Components

### Buttons
- **Primary:** Action Blue background with white text. High-contrast, solid fill.
- **Secondary:** White background with a grey border and charcoal text. Used for secondary actions.
- **Ghost/Tertiary:** No background or border. Use Action Blue text for "Add" or "Edit" actions within a list.

### Form Inputs
- **Text Fields:** 1px border (#C9CCCF) that thickens and changes to Action Blue on focus. Labels should always be visible above the input field.
- **Checkboxes:** Standard 4px radius. When checked, the background is Action Blue with a white checkmark.

### Cards
- Cards are the primary container for synchronization tasks and store stats. They feature a white background, 1px light gray border, and 16px or 24px internal padding. Headers within cards should have a thin bottom divider if the content is a list.

### Status Chips
- Used for sync status (e.g., "In Progress," "Synced," "Failed"). Chips have a subtle background tint (10% opacity) of the semantic color with high-contrast text of the same hue.

### Synchronization Progress Bar
- A custom component for this design system. Use a thin (4px height) bar with a light gray track and an Action Blue fill to show sync completion percentage.
  on-surface-variant: '#424654'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#eff0fa'
  outline: '#737785'
  outline-variant: '#c2c6d6'
  surface-tint: '#0058cc'
  primary: '#0045a3'
  on-primary: '#ffffff'
  primary-container: '#005bd3'
  on-primary-container: '#d3deff'
  inverse-primary: '#b0c6ff'
  secondary: '#5d5e64'
  on-secondary: '#ffffff'
  secondary-container: '#dfdfe6'
  on-secondary-container: '#616268'
  tertiary: '#842d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ac3d00'
  on-tertiary-container: '#ffd5c6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00419c'
  secondary-fixed: '#e2e2e9'
  secondary-fixed-dim: '#c6c6cd'
  on-secondary-fixed: '#1a1c20'
  on-secondary-fixed-variant: '#45474c'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
typography:
  h1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  gutter: 20px
---

## Brand & Style

The design system is engineered to evoke **reliability, precision, and seamless integration**. As a synchronization tool for Shopify merchants, the interface must feel like a natural extension of their existing workflow—utilitarian yet refined. 

The visual direction follows a **Corporate / Modern** aesthetic. It prioritizes clarity over decorative elements, utilizing generous whitespace and a structured information hierarchy to reduce the cognitive load associated with data management. The goal is to build immediate trust, ensuring users feel their store data is being handled by a robust, professional-grade engine.

## Colors

The color palette is anchored by a high-energy **Action Blue**, directly inspired by modern e-commerce administrative interfaces to provide instant recognition for interactive elements. 

- **Primary & Actions:** Use the Action Blue (#005BD3) for primary buttons, active states, and critical navigation links.
- **Surface & Background:** The interface utilizes a tiered gray system. The main background is a cool light gray to reduce glare, while primary content containers sit on pure white surfaces to create clear containment.
- **Typography:** Text is set in a Deep Charcoal (#202223) to ensure maximum contrast without the harshness of pure black. Secondary information uses a muted Slate Gray.
- **Semantic States:** Success (Green), Warning (Amber), and Error (Red) colors are calibrated for high visibility against the light background, ensuring system alerts are never missed.

## Typography

This design system utilizes **Inter** for all typographic needs. Chosen for its exceptional legibility in data-dense SaaS environments, Inter provides a tall x-height and distinct character shapes that remain clear even at small sizes in data tables.

Headlines should be kept concise and use a tighter letter-spacing for a grounded, professional look. Body text leverages a standard 14px base for optimal readability in dashboard contexts, while labels utilize a semi-bold weight and subtle tracking to distinguish themselves from interactive elements.

## Layout & Spacing

The layout philosophy is built on a **12-column fixed grid** system for main content areas, ensuring data consistency across different screen resolutions. 

- **Grid:** Use a 1280px max-width container for dashboard views, centered on the viewport.
- **Rhythm:** A base-4 logic governs all spacing. Use 16px (md) for standard padding within cards and 24px (lg) for margins between major sections.
- **Density:** In data-heavy views (like sync logs), vertical spacing may be reduced to 8px (sm) to increase information density without sacrificing clarity.

## Elevation & Depth

To maintain a clean and professional aesthetic, the design system avoids heavy shadows. Instead, it utilizes **low-contrast outlines** and **tonal layering** to indicate depth.

- **Level 0 (Background):** Light gray (#F6F6F7) surface.
- **Level 1 (Cards/Sections):** Pure white surface with a 1px solid border (#E1E3E5). No shadow.
- **Level 2 (Dropdowns/Modals):** Pure white surface with a subtle ambient shadow (0px 4px 12px rgba(0,0,0,0.08)) and a light border to distinguish the element from the background content.
- **Interaction:** Hover states on interactive cards should transition from a static border to a slightly darker border color rather than increasing shadow depth.

## Shapes

The design system adopts a **Soft (Level 1)** roundedness profile. This 4px (0.25rem) base radius provides a modern touch while maintaining a disciplined, structured feel appropriate for a business tool.

- **Standard Elements:** Buttons, input fields, and checkboxes use the base 4px radius.
- **Containers:** Large cards and informational banners use an 8px (rounded-lg) radius to soften the overall interface.
- **Form Elements:** Maintain strict 4px corners to communicate precision in data entry.

## Components

### Buttons
- **Primary:** Action Blue background with white text. High-contrast, solid fill.
- **Secondary:** White background with a grey border and charcoal text. Used for secondary actions.
- **Ghost/Tertiary:** No background or border. Use Action Blue text for "Add" or "Edit" actions within a list.

### Form Inputs
- **Text Fields:** 1px border (#C9CCCF) that thickens and changes to Action Blue on focus. Labels should always be visible above the input field.
- **Checkboxes:** Standard 4px radius. When checked, the background is Action Blue with a white checkmark.

### Cards
- Cards are the primary container for synchronization tasks and store stats. They feature a white background, 1px light gray border, and 16px or 24px internal padding. Headers within cards should have a thin bottom divider if the content is a list.

### Status Chips
- Used for sync status (e.g., "In Progress," "Synced," "Failed"). Chips have a subtle background tint (10% opacity) of the semantic color with high-contrast text of the same hue.

### Synchronization Progress Bar
- A custom component for this design system. Use a thin (4px height) bar with a light gray track and an Action Blue fill to show sync completion percentage.