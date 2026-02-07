---
trigger: src/app/util/pipes/currency.pipe.ts
glob: ["**/*.ts", "**/*.html"]
description: "Always use CurrencyPipe for currency output"
---

When displaying currency values in templates or code, always use the `CurrencyPipe`.
- In templates (`.html`), use the pipe syntax: `{{ value | currency }}`.
- In components/services (`.ts`), inject `CurrencyPipe` or `CurrencyService` to format values. Do not use random `Intl.NumberFormat` or hardcoded formatting.
