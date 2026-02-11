# Storage Rule

To ensure consistent performance, support for guest mode, and handle large datasets, all persistence **MUST** use `IndexedDB` via `LocalIndexDBStorageService`.

**Direct usage of `localStorage` is STRICTLY FORBIDDEN.**

## Rules

1. **NO `localStorage`**: 
   - Do NOT use `localStorage.getItem()`, `localStorage.setItem()`, or `localStorage.removeItem()`.
   - Exception: `localStorage.clear()` may be used *only* during explicit cache clearing/reset operations to ensure a clean state.

2. **USE `LocalIndexDBStorageService`**:
   - Always inject `LocalIndexDBStorageService`.
   - Use `setItem`, `getItem`, `removeItem`, etc., from this service.
   - This service provides a synchronous-like API (via in-memory cache) while persisting to IndexedDB asynchronously.

3. **Type Safety**:
   - Use `LocalStorageKey` enum for keys.
   - Use `getTyped<T>()` and `setTyped<T>()` when available for better type safety.

## Rationale

- **Performance**: `localStorage` is synchronous and blocks the main thread. `IndexedDB` is asynchronous.
- **Capacity**: `localStorage` has a small quota (usually 5MB). `IndexedDB` allows for much larger storage.
- **Consistency**: Mixing `localStorage` and `IndexedDB` causes synchronization issues and duplicate data (e.g., during guest mode initialization).

