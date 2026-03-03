---
glob: ["**/*.component.ts"]
description: "Guidelines for creating new Angular components: Standalone, OnPush, Signals, and Naming"
---

# Component Creation Guide

Follow these rules when creating new Angular components in the codebase.

## 1. Architecture & Performance
- **Standalone**: All new components MUST be `standalone: true`.
- **Change Detection**: Always use `changeDetection: ChangeDetectionStrategy.OnPush` to ensure optimal performance.
- **Dependency Injection**: Use the `inject()` function instead of constructor injection for cleaner code and better type inference.
    ```typescript
    private store = inject(Store<AppState>);
    private dialog = inject(MatDialog);
    ```

## 2. Reactive Programming (Signals)
- **Signals**: Prefer **Angular Signals** (`signal`, `computed`, `effect`) over manual `Subject` or `BehaviorSubject` for local state.
- **RxJS Integration**: Use `toSignal()` to convert store selectors or service observables into signals.
    ```typescript
    family = toSignal(this.store.select(FamilySelectors.selectFamily));
    ```
- **Cleanup**: Use `takeUntilDestroyed()` or `DestroyRef` to manage subscription lifecycles.

## 3. Template & Styling
- **Material UI**: Use **Angular Material** components as the primary UI building blocks.
- **Tailwind CSS**: Use Tailwind for layout (flex, grid), spacing (m, p), and sizing.
- **Color Variables**: Reference CSS variables (e.g., `var(--primary-500)`) for custom colors to ensure dark mode support.
- **Responsive Design**: Follow the **Mobile-First** approach using Tailwind breakpoints (`sm:`, `md:`, `lg:`).

## 4. Structure & Naming
- **File Organization**: Keep component logic (`.ts`), template (`.html`), and styles (`.scss`) in separate files within the component directory.
- **Naming Convention**: Use kebab-case for directories and filenames, and PascalCase for component class names.
    - Example: `family-dashboard/family-dashboard.component.ts` -> `FamilyDashboardComponent`
- **Imports**: Organize imports logically: Angular core, store/actions, components/directives, and finally local models/services.

## 5. UI Best Practices
- **Currency Formatting**: Always use `CurrencyPipe` for displaying amounts. Avoid manual `Intl.NumberFormat` in components.
- **Loading States**: Always provide skeleton loaders or spinners for asynchronous actions.
- **Empty States**: Design "Empty States" (e.g., "No transactions found") to guide the user.
- **Directives**: Use `appImageFallback` for user avatars or group icons that might fail to load.
