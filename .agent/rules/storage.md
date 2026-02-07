# Storage Rule

To ensure consistent performance and support for guest mode, all persistence must use the `LocalStorageService` (IndexedDB + In-Memory Cache). Direct access to the `localStorage` API is forbidden.

## Rules

- **DO NOT** use `localStorage.getItem()`, `localStorage.setItem()`, or `localStorage.removeItem()` directly.
- **ALWAYS** inject and use `LocalStorageService`.
- If access is needed in a non-injectable context (e.g., Redux MetaReducer), use the static `LocalStorageService.instance` (after it has been initialized).
- Use `getTyped` and `setTyped` when possible for better type safety.

## Rationale

- `localStorage` is synchronous and can block the main thread, especially with large data like application state.
- `IndexedDB` is asynchronous and provides much larger storage capacity.
- `LocalStorageService` provides a synchronous-like API via an in-memory cache, ensuring high performance while persisting data asynchronously.
