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
- **Primary** (`bg-primary-500`, `text-primary-500`): Main actions, active states, branding.
- **Surface** (`bg-surface-50` to `900`): Backgrounds.
    - `bg-surface-50/100`: Main page background.
    - `bg-surface-200/300`: Cards, sidebars.
- **text color**
     -`text-neutral-500`: secondary logic text
     -`text-neutral-900`: Main logic text like heading etc
- **Error/Success/Warning**: Status messages (`text-error-500`, `bg-success-100`, etc.).
- **Neutral**: Borders, subtle dividers.

**Rule**: Always use the defined tailwind colors (e.g., `text-primary-500`) instead of hex codes or standard colors (`text-blue-500`).

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
- **Styling Material**: Use Tailwind utility classes to handle **layout, spacing, and sizing** of Material components.
    - Example: `<button mat-raised-button class="w-full mt-4">Login</button>`
