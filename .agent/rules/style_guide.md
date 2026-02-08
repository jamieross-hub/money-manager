---
trigger: src/styles/styles.scss
glob: ["**/*.html", "**/*.ts", "**/*.scss"]
description: "Style guide: Colors (Tailwind + CSS Vars), Responsiveness, and UI Components (Material)"
---

# Styling Guide

## 1. Color System & Dark Mode
The application uses **CSS Variables** that automatically adapt to Light and Dark themes. 
**Do NOT use `dark:` modifiers for colors.** Instead, use the semantic Tailwind classes that map to these variables.

### Color Palette Usage
The following CSS variables are available and automatically adapt to the theme:

- **Primary**: `--primary-50` to `--primary-900` (e.g., `var(--primary-500)`)
- **Secondary**: `--secondary-50` to `--secondary-900`
- **Tertiary**: `--tertiary-50` to `--tertiary-900`
- **Error**: `--error-50` to `--error-900`
- **Success**: `--success-50` to `--success-900`
- **Warning**: `--warning-50` to `--warning-900`
- **Neutral**: `--neutral-50` to `--neutral-900`
- **Surface**: `--surface-50` to `--surface-500`

**Tailwind Mapping**:
- **Primary** (`bg-primary-500`, `text-primary-500`): Main actions, active states, branding.
- **Surface** (`bg-surface-50` to `900`): Backgrounds.
    - `bg-surface-50/100`: Main page background.
    - `bg-surface-200/300`: Cards, sidebars.
- **Text**:
    - `text-neutral-500`: Secondary text/descriptions.
    - `text-neutral-900`: Main headings/titles.
- **Error/Success/Warning**: Status messages (`text-error-500`, `bg-success-100`, etc.).

**Rule**: Always use the defined CSS variables or Tailwind classes instead of hex codes or standard colors.

## 2. Responsiveness (Tailwind CSS)
Follow a **Mobile-First** approach.
- Write styles for mobile definitions first (no prefix).
- Use breakpoints for larger screens: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`.
- **Text Sizing**: Use the custom responsive utilities defined in `styles.scss` to ensure text scales smoothly:
    - `text-responsive-xs`
    - `text-responsive-sm`
    - `text-responsive-base`
    - `text-responsive-lg`
    - `text-responsive-xl`
    - `text-responsive-2xl`
    - `text-responsive-3xl`
    - `text-responsive-4xl`

## 3. UI Components (Angular Material)
- **Primary Library**: Use **Angular Material** for all interactive components (Buttons, Inputs, Dialogs, Sidebars, Icons).
    - Example: `<button mat-button color="primary">` instead of `<button class="bg-primary...">`.
    - Example: `<mat-icon>` for icons.
- **Form Fields**:
    - **Rule**: Always use `appearance="fill"` for `<mat-form-field>`. This ensures visual consistency across the application.
- **Styling Material**: Use Tailwind utility classes to handle **layout, spacing, and sizing** of Material components.
    - Example: `<button mat-raised-button class="w-full mt-4">Login</button>`
